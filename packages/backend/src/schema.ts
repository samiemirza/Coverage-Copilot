import type pg from "pg";
import { GraphQLError } from "graphql";
import type { Env } from "@coverage-copilot/shared";
import { ingestPolicyDocument } from "./ingest/ingestService.js";
import { validatePdfUpload } from "./ingest/validateUpload.js";
import type { PolicyExtractor } from "./ingest/extractors/index.js";
import {
  answerCoverageQuestion,
  streamCoverageAnswer,
  type CoverageResult,
} from "./coverage/coverageQa.js";
import { coverageRateLimiter } from "./coverage/rateLimiter.js";

export const typeDefs = /* GraphQL */ `
  "Uploaded file (GraphQL multipart request spec, provided by Yoga)."
  scalar File

  type Policy {
    id: ID!
    businessId: ID!
    filename: String!
    uploadedAt: String!
  }

  "A pointer back to the exact policy section an answer was drawn from."
  type Citation {
    policyId: ID!
    chunkId: ID!
    policyFilename: String!
    section: String
    snippet: String!
  }

  "A grounded coverage answer with the sources it relied on."
  type CoverageAnswer {
    id: ID!
    answer: String!
    citations: [Citation!]!
    "False when no relevant policy text was found (a safe, non-guessed answer)."
    grounded: Boolean!
  }

  "One event in a streamed coverage answer: a status, a token delta, or the final result."
  type CoverageAnswerChunk {
    type: String!
    status: String
    delta: String
    answer: String
    citations: [Citation!]
    grounded: Boolean
    answerId: ID
  }

  type Query {
    "Liveness check — the API process is up."
    health: String!
    "Round-trips a SELECT through Postgres to prove the DB connection is live."
    dbHealth: String!
  }

  type Mutation {
    "Upload a policy PDF; it is chunked, embedded, and stored for coverage Q&A."
    ingestPolicy(businessId: ID!, file: File!): Policy!
    "Ask a plain-language coverage question; returns a grounded, cited answer."
    askCoverageQuestion(businessId: ID!, question: String!): CoverageAnswer!
  }

  type Subscription {
    "Same as askCoverageQuestion, streamed token-by-token for the chat UI."
    coverageAnswerStream(businessId: ID!, question: String!): CoverageAnswerChunk!
  }
`;

export interface GraphQLContext {
  pool: pg.Pool;
  env: Env;
  extractor: PolicyExtractor;
}

// Yoga delivers uploaded files as WHATWG File (Blob) objects.
interface UploadedFile {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * Security §4.2: tenant data must be scoped to the authenticated caller. There
 * is no auth in this demo, so businessId comes from the client and we only
 * verify the business exists. DEMO GAP: in production businessId must come from
 * the authenticated session (or be checked against the caller's tenant), never
 * trusted from the client argument alone. Flagged loudly on purpose; every
 * tenant-scoped operation funnels through this one check so it's easy to
 * replace with a real authorization check later.
 */
async function assertBusinessExists(pool: pg.Pool, businessId: string): Promise<void> {
  const result = await pool.query("SELECT 1 FROM businesses WHERE id = $1", [businessId]);
  if (result.rowCount === 0) {
    throw new GraphQLError("We couldn't find that business.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
}

function validateQuestion(question: string): string {
  const trimmed = question.trim();
  if (trimmed.length === 0) {
    throw new GraphQLError("Please enter a question.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  if (trimmed.length > 1000) {
    throw new GraphQLError("That question is too long. Please shorten it.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return trimmed;
}

/**
 * Persist the answer (build-spec §5 coverage_answers) so the feedback loop
 * (DESIGN §5.8 thumbs up/down → eval set) has a row to attach to. Citations are
 * stored as JSON. Security §4.4: this table holds answer text derived from
 * policy content — it is never written to application logs, only the DB.
 */
async function persistCoverageAnswer(
  pool: pg.Pool,
  businessId: string,
  question: string,
  result: CoverageResult,
): Promise<string> {
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO coverage_answers (business_id, question, answer, citations)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [businessId, question, result.answer, JSON.stringify(result.citations)],
  );
  return inserted.rows[0]!.id;
}

export const resolvers = {
  Query: {
    health: () => "ok",
    dbHealth: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      const result = await ctx.pool.query("SELECT 1 AS ok");
      return result.rows[0]?.ok === 1 ? "ok" : "unexpected result";
    },
  },

  Mutation: {
    ingestPolicy: async (
      _parent: unknown,
      args: { businessId: string; file: UploadedFile },
      ctx: GraphQLContext,
    ) => {
      const { businessId, file } = args;
      const buffer = Buffer.from(await file.arrayBuffer());

      // Validate the upload before doing any work (Security §4.5).
      validatePdfUpload(file.name, buffer);
      await assertBusinessExists(ctx.pool, businessId);

      try {
        return await ingestPolicyDocument({
          pool: ctx.pool,
          businessId,
          filename: file.name,
          buffer,
          // No raw-file persistence in the demo. Production: upload the bytes
          // to a private S3 bucket and store a key here, served later via a
          // pre-signed, time-limited URL (Security §4.4).
          storageUrl: `uploaded://${file.name}`,
          apiKey: ctx.env.OPENAI_API_KEY,
          extractor: ctx.extractor,
        });
      } catch (err) {
        if (err instanceof Error && err.message === "NO_EXTRACTABLE_TEXT") {
          throw new GraphQLError(
            "We couldn't read any text from that PDF. If it's a scanned document, please upload a text-based PDF.",
            { extensions: { code: "BAD_USER_INPUT" } },
          );
        }
        // Re-throw everything else; Yoga masks internal errors from the client
        // by default (Security §4.5), keeping detail in server logs only.
        throw err;
      }
    },

    askCoverageQuestion: async (
      _parent: unknown,
      args: { businessId: string; question: string },
      ctx: GraphQLContext,
    ) => {
      const question = validateQuestion(args.question);
      await assertBusinessExists(ctx.pool, args.businessId);
      coverageRateLimiter.consume(args.businessId); // Security §4.7

      const result = await answerCoverageQuestion({
        pool: ctx.pool,
        businessId: args.businessId,
        question,
        apiKey: ctx.env.OPENAI_API_KEY,
      });
      const id = await persistCoverageAnswer(ctx.pool, args.businessId, question, result);
      return { id, ...result };
    },
  },

  Subscription: {
    coverageAnswerStream: {
      subscribe: async function* (
        _parent: unknown,
        args: { businessId: string; question: string },
        ctx: GraphQLContext,
      ) {
        const question = validateQuestion(args.question);
        await assertBusinessExists(ctx.pool, args.businessId);
        coverageRateLimiter.consume(args.businessId); // Security §4.7

        for await (const chunk of streamCoverageAnswer({
          pool: ctx.pool,
          businessId: args.businessId,
          question,
          apiKey: ctx.env.OPENAI_API_KEY,
        })) {
          if (chunk.type === "done") {
            const answerId = await persistCoverageAnswer(ctx.pool, args.businessId, question, {
              answer: chunk.answer,
              citations: chunk.citations,
              grounded: chunk.grounded,
            });
            yield { coverageAnswerStream: { ...chunk, answerId } };
          } else {
            yield { coverageAnswerStream: chunk };
          }
        }
      },
    },
  },
};

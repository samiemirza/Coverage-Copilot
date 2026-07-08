import type pg from "pg";
import { GraphQLError } from "graphql";
import type { Env } from "@coverage-copilot/shared";
import { ingestPolicyDocument } from "./ingest/ingestService.js";
import { validatePdfUpload } from "./ingest/validateUpload.js";
import type { PolicyExtractor } from "./ingest/extractors/index.js";

export const typeDefs = /* GraphQL */ `
  "Uploaded file (GraphQL multipart request spec, provided by Yoga)."
  scalar File

  type Policy {
    id: ID!
    businessId: ID!
    filename: String!
    uploadedAt: String!
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

      // Security §4.2: tenant data must be scoped to the authenticated
      // caller. There is no auth in this demo yet, so businessId comes from
      // the client and we only verify the business exists. THIS IS A DEMO
      // GAP: in production businessId must come from the authenticated
      // session (or be checked against the caller's tenant), never trusted
      // from the client argument alone. Flagged loudly on purpose.
      const businessExists = await ctx.pool.query(
        "SELECT 1 FROM businesses WHERE id = $1",
        [businessId],
      );
      if (businessExists.rowCount === 0) {
        throw new GraphQLError("We couldn't find that business.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

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
  },
};

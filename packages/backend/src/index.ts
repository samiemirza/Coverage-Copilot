import "./loadEnvFile.js";
import { createServer } from "node:http";
import { createYoga, createSchema, type Plugin } from "graphql-yoga";
import { NoSchemaIntrospectionCustomRule } from "graphql";
import depthLimit from "graphql-depth-limit";
import { loadEnv } from "@coverage-copilot/shared";
import { createPool } from "./db.js";
import { typeDefs, resolvers, type GraphQLContext } from "./schema.js";
import { createExtractor } from "./ingest/extractors/index.js";

const env = loadEnv();
const pool = createPool(env);
const extractor = createExtractor();
const isProduction = process.env.NODE_ENV === "production";

/**
 * GraphQL hardening (Security §4.6). Now that real, LLM-backed operations exist
 * (askCoverageQuestion), the abuse surface flagged back in Milestone 1 is real:
 *  - Query depth limit: a nested/recursive query can fan out into many resolver
 *    executions — and some resolvers here call a paid LLM. Cap nesting depth.
 *  - Introspection off in production: don't hand attackers a full schema map.
 *    Left on in dev so tooling/GraphiQL still work.
 * Per-user rate limiting (also §4.7) lives at the resolver via coverageRateLimiter.
 */
const securityPlugin: Plugin<GraphQLContext> = {
  onValidate({ addValidationRule }) {
    addValidationRule(depthLimit(10));
    if (isProduction) {
      addValidationRule(NoSchemaIntrospectionCustomRule);
    }
  },
};

const yoga = createYoga<object, GraphQLContext>({
  schema: createSchema({ typeDefs, resolvers }),
  context: (): GraphQLContext => ({ pool, env, extractor }),
  cors: { origin: env.CORS_ORIGIN, credentials: true },
  graphiql: !isProduction,
  plugins: [securityPlugin],
  // File uploads (multipart) are enabled by default. Upload size is enforced
  // in validatePdfUpload after buffering. Production would ALSO cap the raw
  // request body at the reverse proxy / load balancer (e.g. an ALB or nginx
  // client_max_body_size) so oversized uploads are rejected before they reach
  // Node at all — defense in depth.
});

const server = createServer(yoga);

server.listen(env.BACKEND_PORT, () => {
  console.log(`Coverage Copilot backend listening on :${env.BACKEND_PORT}/graphql`);
});

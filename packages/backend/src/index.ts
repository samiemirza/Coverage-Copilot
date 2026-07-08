import "./loadEnvFile.js";
import { createServer } from "node:http";
import { createYoga, createSchema } from "graphql-yoga";
import { loadEnv } from "@coverage-copilot/shared";
import { createPool } from "./db.js";
import { typeDefs, resolvers, type GraphQLContext } from "./schema.js";
import { createExtractor } from "./ingest/extractors/index.js";

const env = loadEnv();
const pool = createPool(env);
const extractor = createExtractor();

// Introspection stays on in dev for tooling; per Security §4.6 this must be
// disabled in production, alongside query depth/complexity limits. Deferred
// to the milestone where the read-side mutations (askCoverageQuestion,
// startRiskReview) land and the abuse surface actually appears.
const yoga = createYoga<object, GraphQLContext>({
  schema: createSchema({ typeDefs, resolvers }),
  context: (): GraphQLContext => ({ pool, env, extractor }),
  cors: { origin: env.CORS_ORIGIN, credentials: true },
  graphiql: true,
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

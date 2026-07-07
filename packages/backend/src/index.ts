import "dotenv/config";
import { createServer } from "node:http";
import { createYoga, createSchema } from "graphql-yoga";
import { loadEnv } from "@coverage-copilot/shared";
import { createPool } from "./db.js";
import { typeDefs, resolvers, type GraphQLContext } from "./schema.js";

const env = loadEnv();
const pool = createPool(env);

// Introspection stays on in dev for tooling; per Security §4.6 this must be
// disabled in production, alongside query depth/complexity limits. Deferred
// to the milestone where real mutations (askCoverageQuestion, startRiskReview)
// land, since a hello-world schema has nothing worth abusing yet.
const yoga = createYoga<object, GraphQLContext>({
  schema: createSchema({ typeDefs, resolvers }),
  context: (): GraphQLContext => ({ pool }),
  cors: { origin: env.CORS_ORIGIN, credentials: true },
  graphiql: true,
});

const server = createServer(yoga);

server.listen(env.BACKEND_PORT, () => {
  console.log(`Coverage Copilot backend listening on :${env.BACKEND_PORT}/graphql`);
});

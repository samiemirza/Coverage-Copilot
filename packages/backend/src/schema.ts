import type pg from "pg";

export const typeDefs = /* GraphQL */ `
  type Query {
    "Liveness check — the API process is up."
    health: String!
    "Round-trips a SELECT through Postgres to prove the DB connection is live."
    dbHealth: String!
  }
`;

export interface GraphQLContext {
  pool: pg.Pool;
}

export const resolvers = {
  Query: {
    health: () => "ok",
    dbHealth: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      const result = await ctx.pool.query("SELECT 1 AS ok");
      return result.rows[0]?.ok === 1 ? "ok" : "unexpected result";
    },
  },
};

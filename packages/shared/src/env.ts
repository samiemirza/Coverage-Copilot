import { z } from "zod";

/**
 * Every process that touches Postgres or Anthropic (backend API, Temporal
 * worker, MCP server) validates its env through this schema so a missing
 * secret fails fast at boot instead of surfacing as a confusing runtime error.
 */
export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(1),
  // Used only by the ingestion pipeline (chunk embedding) for now. See
  // Milestone 2 notes: OpenAI text-embedding-3-small, 1536 dims, matches the
  // policy_chunks.embedding column created in Milestone 1.
  OPENAI_API_KEY: z.string().min(1),
  BACKEND_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

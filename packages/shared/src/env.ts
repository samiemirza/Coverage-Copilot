import { z } from "zod";

/**
 * Every process that touches Postgres or Anthropic (backend API, Temporal
 * worker, MCP server) validates its env through this schema so a missing
 * secret fails fast at boot instead of surfacing as a confusing runtime error.
 */
export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  // OpenAI is the single LLM provider for this build: embeddings (Milestone 2,
  // text-embedding-3-small) AND coverage-answer generation (Milestone 3, via
  // the Vercel AI SDK's OpenAI provider). NB: this deviates from build-spec §8,
  // which specified Claude — done at the user's request.
  OPENAI_API_KEY: z.string().min(1),
  // Optional and currently unused: the build spec targeted Claude for
  // generation. Kept so switching the generation provider back to Anthropic is
  // a one-line change, not a schema change.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
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

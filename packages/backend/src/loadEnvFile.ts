import dotenv from "dotenv";
import path from "node:path";

/**
 * dotenv's default `dotenv/config` import looks for `.env` relative to
 * process.cwd(). That's fine when Docker starts the process (cwd is
 * /app/packages/backend, but Docker already injects env vars directly via
 * docker-compose's env_file/environment — this becomes a harmless no-op).
 * It breaks for local, non-Docker runs like `npm run ingest --workspace
 * packages/backend`, where npm sets cwd to the workspace package, not the
 * repo root where `.env` actually lives. Anchoring to this file's own
 * location makes the lookup independent of how/where the process was
 * launched.
 */
dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });

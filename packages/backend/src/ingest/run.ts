import "../loadEnvFile.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { embedTexts, loadEnv, retrieveRelevantChunks } from "@coverage-copilot/shared";
import { createPool } from "../db.js";
import { ingestPolicyDocument } from "./ingestService.js";
import { createExtractor } from "./extractors/index.js";
import { policies as policyContent } from "../seed-data/policy-content.js";

const env = loadEnv();
const pool = createPool(env);
const extractor = createExtractor();

/**
 * Seed ingestion for the demo. Uses the SAME ingestPolicyDocument service the
 * GraphQL mutation uses — this script only adds seed-specific behavior:
 * resetting the business's policies first (so re-running is idempotent) and a
 * retrieval smoke test at the end. It does not re-implement ingestion.
 *
 *   docker compose exec backend npm run ingest
 */
async function main() {
  const businessResult = await pool.query<{ id: string; name: string }>(
    "SELECT id, name FROM businesses ORDER BY created_at ASC LIMIT 1",
  );
  const business = businessResult.rows[0];
  if (!business) {
    throw new Error("No seeded business found — did Milestone 1's seed SQL run?");
  }
  console.log(`Ingesting policies for business: ${business.name} (${business.id})`);
  console.log(`Using extractor: ${extractor.name}`);

  // Seed-only reset so re-running doesn't pile up duplicate policies/chunks.
  // ON DELETE CASCADE (Milestone 1 schema) removes dependent chunks too.
  await pool.query("DELETE FROM policies WHERE business_id = $1", [business.id]);

  for (const policy of policyContent) {
    const pdfPath = path.join(import.meta.dirname, "../seed-data/policies", policy.filename);
    const buffer = await readFile(pdfPath);
    const result = await ingestPolicyDocument({
      pool,
      businessId: business.id,
      filename: policy.filename,
      buffer,
      storageUrl: `local://seed-data/policies/${policy.filename}`,
      apiKey: env.OPENAI_API_KEY,
      extractor,
    });
    const countResult = await pool.query<{ n: string }>(
      "SELECT count(*) AS n FROM policy_chunks WHERE policy_id = $1",
      [result.id],
    );
    console.log(`  ${policy.filename}: ${countResult.rows[0]!.n} chunks`);
  }

  await verifyRetrieval(business.id);
  await pool.end();
}

/**
 * Smoke test for the milestone's "done when": embed a real coverage question
 * and confirm the tenant-scoped vector search returns the section that
 * actually answers it — the same retrieveRelevantChunks path Milestone 3's
 * askCoverageQuestion resolver will use.
 */
async function verifyRetrieval(businessId: string) {
  const question = "Am I covered if a customer slips and falls in my restaurant?";
  const [queryEmbedding] = await embedTexts([question], env.OPENAI_API_KEY);
  const results = await retrieveRelevantChunks(pool, businessId, queryEmbedding!, 3);

  console.log(`\nRetrieval smoke test for: "${question}"`);
  for (const r of results) {
    console.log(
      `  [distance ${r.distance.toFixed(4)}] ${r.policyFilename} §${r.sectionNumber} ${r.sectionTitle}`,
    );
  }

  const top = results[0];
  if (top?.sectionNumber !== "4.2") {
    throw new Error(
      `Expected top retrieval hit to be §4.2 (Bodily Injury to Customers), got §${top?.sectionNumber}`,
    );
  }
  console.log("Retrieval smoke test passed.");
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exitCode = 1;
});

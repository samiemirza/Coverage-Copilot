import "../loadEnvFile.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  chunkPolicyText,
  embedTexts,
  loadEnv,
  retrieveRelevantChunks,
} from "@coverage-copilot/shared";
import { createPool } from "../db.js";
import { extractPdfText } from "./extractText.js";
import { policies as policyContent } from "../seed-data/policy-content.js";

const env = loadEnv();
const pool = createPool(env);

/**
 * Milestone 2 ingestion: PDF -> extracted text -> section-aware chunks ->
 * embeddings -> policy_chunks rows. Run manually (not part of Postgres's
 * init scripts) because it needs Node, network access, and a real
 * OPENAI_API_KEY — none of which docker-entrypoint-initdb.d SQL can do.
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

  // Re-running this script should leave the DB in the same state, not pile
  // up duplicate policies/chunks — safe to do because ON DELETE CASCADE
  // (Milestone 1 schema) removes the dependent policy_chunks rows too.
  await pool.query("DELETE FROM policies WHERE business_id = $1", [business.id]);

  for (const policy of policyContent) {
    const pdfPath = path.join(
      import.meta.dirname,
      "../seed-data/policies",
      policy.filename,
    );
    const buffer = await readFile(pdfPath);
    const text = await extractPdfText(buffer);
    const chunks = chunkPolicyText(text);

    if (chunks.length === 0) {
      console.warn(`No sections detected in ${policy.filename} — skipping.`);
      continue;
    }

    const policyResult = await pool.query<{ id: string }>(
      `INSERT INTO policies (business_id, filename, storage_url)
       VALUES ($1, $2, $3)
       RETURNING id`,
      // Local file path stands in for a real storage URL in this demo.
      // Security §4.4: production must use a private bucket + pre-signed,
      // time-limited URLs — never a public bucket, never a bare local path.
      [business.id, policy.filename, `local://seed-data/policies/${policy.filename}`],
    );
    const policyId = policyResult.rows[0]!.id;

    const embeddings = await embedTexts(
      chunks.map((c) => c.text),
      env.OPENAI_API_KEY,
    );

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const embedding = embeddings[i]!;
      await pool.query(
        `INSERT INTO policy_chunks (policy_id, chunk_text, embedding, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          policyId,
          chunk.text,
          `[${embedding.join(",")}]`,
          JSON.stringify({
            sectionNumber: chunk.sectionNumber,
            sectionTitle: chunk.sectionTitle,
          }),
        ],
      );
    }

    console.log(`  ${policy.filename}: ${chunks.length} chunks`);
  }

  await verifyRetrieval(business.id);
  await pool.end();
}

/**
 * Smoke test for the milestone's "done when": embeds a real coverage
 * question and confirms the tenant-scoped vector search returns the section
 * that actually answers it. This is the same retrieveRelevantChunks function
 * Milestone 3's askCoverageQuestion resolver will call.
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

import type pg from "pg";
import { chunkSections, embedTexts, type Policy } from "@coverage-copilot/shared";
import type { PolicyExtractor } from "./extractors/index.js";

export interface IngestParams {
  pool: pg.Pool;
  businessId: string;
  filename: string;
  buffer: Buffer;
  storageUrl: string;
  apiKey: string;
  extractor: PolicyExtractor;
}

/**
 * Ingests ONE policy document for a business: extract -> chunk -> embed ->
 * persist. This is the single code path shared by both the GraphQL
 * ingestPolicy mutation and the seed script (CLAUDE.md §6: keep business
 * logic in shared modules reusable across the API, activities, and the script
 * — the mutation and the CLI must not drift into two implementations).
 *
 * Ordering matters for two reasons:
 *   1. The embeddings network call happens BEFORE the DB transaction opens, so
 *      we never hold a Postgres transaction open across a slow external API
 *      call (that would pin a connection and invite lock contention).
 *   2. The policy row and all its chunks are inserted inside one transaction,
 *      so a failure halfway can't leave a policy with a partial set of chunks
 *      (which would silently corrupt retrieval).
 */
export async function ingestPolicyDocument(params: IngestParams): Promise<Policy> {
  const { pool, businessId, filename, buffer, storageUrl, apiKey, extractor } = params;

  const sections = await extractor.extract(buffer);
  const chunks = chunkSections(sections);
  if (chunks.length === 0) {
    // Thrown as a plain Error here; the resolver maps it to a safe,
    // user-facing GraphQLError. A born-scanned PDF with no text layer would
    // land here under the layout-aware extractor (see extractors/textract.ts).
    throw new Error("NO_EXTRACTABLE_TEXT");
  }

  const embeddings = await embedTexts(
    chunks.map((c) => c.text),
    apiKey,
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const policyResult = await client.query<{
      id: string;
      business_id: string;
      filename: string;
      uploaded_at: string;
    }>(
      `INSERT INTO policies (business_id, filename, storage_url)
       VALUES ($1, $2, $3)
       RETURNING id, business_id, filename, uploaded_at`,
      [businessId, filename, storageUrl],
    );
    const policyRow = policyResult.rows[0]!;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const embedding = embeddings[i]!;
      await client.query(
        `INSERT INTO policy_chunks (policy_id, chunk_text, embedding, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          policyRow.id,
          chunk.text,
          `[${embedding.join(",")}]`,
          JSON.stringify({
            sectionNumber: chunk.sectionNumber,
            sectionTitle: chunk.sectionTitle,
          }),
        ],
      );
    }

    await client.query("COMMIT");

    return {
      id: policyRow.id,
      businessId: policyRow.business_id,
      filename: policyRow.filename,
      storageUrl,
      uploadedAt: new Date(policyRow.uploaded_at).toISOString(),
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

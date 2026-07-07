import type pg from "pg";

export interface RetrievedChunk {
  chunkId: string;
  policyId: string;
  policyFilename: string;
  sectionNumber: string | null;
  sectionTitle: string | null;
  chunkText: string;
  distance: number;
}

/**
 * Retrieves the k policy chunks most similar to queryEmbedding, for one
 * business only.
 *
 * Security §4.2: "When retrieving chunks for RAG, filter by business_id
 * before the vector search, so one tenant's embeddings can never surface in
 * another tenant's answer." The WHERE clause here does that filtering in the
 * same query as the similarity search — there is no code path that runs the
 * <=> operator before the business_id predicate is applied, and no caller
 * can bypass it because businessId is a required argument, not optional.
 */
export async function retrieveRelevantChunks(
  pool: pg.Pool,
  businessId: string,
  queryEmbedding: number[],
  k: number = 5,
): Promise<RetrievedChunk[]> {
  const embeddingLiteral = `[${queryEmbedding.join(",")}]`;
  const result = await pool.query(
    `SELECT
       pc.id AS chunk_id,
       pc.policy_id,
       p.filename AS policy_filename,
       pc.metadata->>'sectionNumber' AS section_number,
       pc.metadata->>'sectionTitle' AS section_title,
       pc.chunk_text,
       pc.embedding <=> $1 AS distance
     FROM policy_chunks pc
     JOIN policies p ON p.id = pc.policy_id
     WHERE p.business_id = $2
     ORDER BY pc.embedding <=> $1
     LIMIT $3`,
    [embeddingLiteral, businessId, k],
  );

  return result.rows.map((row) => ({
    chunkId: row.chunk_id,
    policyId: row.policy_id,
    policyFilename: row.policy_filename,
    sectionNumber: row.section_number,
    sectionTitle: row.section_title,
    chunkText: row.chunk_text,
    distance: Number(row.distance),
  }));
}

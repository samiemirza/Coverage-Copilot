import OpenAI from "openai";

/**
 * Embeddings for both ingestion (embedding policy chunks) and retrieval
 * (embedding the user's question) go through this one function, so the
 * Q&A resolver (M3) and the Temporal retrievePolicyContext activity (M4)
 * can never accidentally embed with a different model/dimension than the
 * chunks were stored with.
 */
export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

export async function embedTexts(
  texts: string[],
  apiKey: string,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const client = new OpenAI({ apiKey });
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

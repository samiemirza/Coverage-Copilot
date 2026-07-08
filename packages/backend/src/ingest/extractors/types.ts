import type { ExtractedSection } from "@coverage-copilot/shared";

/**
 * The ingestion pipeline depends on this interface, never on a concrete
 * extractor. That's the whole point of the abstraction: swapping the
 * regex/heuristic extractor for a document-AI service (AWS Textract, etc.)
 * in production is a one-line change in the factory, with zero changes to
 * chunking, embedding, storage, or the mutation resolver.
 */
export interface PolicyExtractor {
  readonly name: string;
  extract(buffer: Buffer): Promise<ExtractedSection[]>;
}

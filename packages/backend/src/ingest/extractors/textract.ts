import type { ExtractedSection } from "@coverage-copilot/shared";
import type { PolicyExtractor } from "./types.js";

/**
 * PRODUCTION extractor (not wired on by default — documented skeleton).
 *
 * The layout-aware extractor is good for born-digital, single-column policy
 * PDFs, but real vendor documents include scanned/faxed pages (no text
 * layer), multi-column layouts, and tables of limits. Those need a document
 * AI service. Because the stack is AWS (build-spec §2), the natural choice is
 * **AWS Textract**, specifically its LAYOUT + TABLES analysis:
 *
 *   - Textract returns typed blocks — LAYOUT_TITLE, LAYOUT_SECTION_HEADER,
 *     LAYOUT_TEXT, TABLE, LINE — with geometry. You map SECTION_HEADER blocks
 *     to section boundaries and the TEXT/TABLE blocks between them to bodies,
 *     which is far more reliable than inferring headings from font size.
 *   - It runs OCR, so scanned policies (which the font heuristic can't touch
 *     at all — there's no text layer) become searchable.
 *   - For multi-page PDFs you use the async StartDocumentAnalysis /
 *     GetDocumentAnalysis flow against a document already in S3 (which is
 *     where Security §4.4 says the raw PDF belongs anyway).
 *
 * Swapping it in is a one-line change in the factory (createExtractor) — no
 * other pipeline code changes — because everything depends on the
 * PolicyExtractor interface, not on pdfjs.
 *
 * Alternatives with the same shape: Unstructured.io (open-source, returns
 * Title/NarrativeText/Table elements), Azure Document Intelligence, Google
 * Document AI, or an LLM-based parser (Claude over page images with a
 * structured-output section schema — ties into the structured-outputs theme,
 * but costs more per page).
 */
export const textractExtractor: PolicyExtractor = {
  name: "aws-textract",

  extract(_buffer: Buffer): Promise<ExtractedSection[]> {
    // Intentionally not implemented in the demo: requires AWS credentials, an
    // S3 bucket for the source document, and the @aws-sdk/client-textract
    // dependency. Left as a typed skeleton so the integration point is
    // explicit and the interface contract is visible.
    throw new Error(
      "textractExtractor is a production skeleton and is not configured in this demo.",
    );
  },
};

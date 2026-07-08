import type { PolicyExtractor } from "./types.js";
import { layoutAwareExtractor } from "./layoutAware.js";
import { textractExtractor } from "./textract.js";

export type { PolicyExtractor } from "./types.js";
export { layoutAwareExtractor } from "./layoutAware.js";
export { textractExtractor } from "./textract.js";

/**
 * Single place that decides which extractor the pipeline uses. In production
 * you'd branch on an env flag (e.g. EXTRACTOR=textract) or on document type
 * (scanned -> Textract, born-digital -> layout-aware). The rest of the
 * ingestion code never names a concrete extractor, so this is the only line
 * that changes when the strategy changes.
 */
export function createExtractor(): PolicyExtractor {
  const kind = process.env.EXTRACTOR ?? "layout-aware";
  switch (kind) {
    case "textract":
      return textractExtractor;
    case "layout-aware":
    default:
      return layoutAwareExtractor;
  }
}

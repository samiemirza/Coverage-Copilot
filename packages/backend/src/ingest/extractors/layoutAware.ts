import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ExtractedSection } from "@coverage-copilot/shared";
import type { PolicyExtractor } from "./types.js";

/**
 * Layout-aware extractor. Detects section boundaries by VISUAL PROMINENCE
 * (font size), not by a rigid "N.N" numbering regex. This is the key
 * production-robustness fix over the old text-regex approach:
 *
 *   - It works on any policy whose headings are rendered larger than body
 *     text — which is the overwhelming majority of real documents — instead
 *     of requiring the exact "4.2 Heading" convention my synthetic PDFs used.
 *   - Section numbering is still parsed *when present* (for the §4.2-style
 *     citation label), but it is no longer REQUIRED to find a boundary. A
 *     heading with no number degrades gracefully to {sectionNumber: null,
 *     sectionTitle: <heading text>} rather than being missed entirely.
 *
 * How it works: pdfjs reports a font height per text item. The most common
 * height across the document is treated as body text; any line whose text is
 * rendered meaningfully larger starts a new section. Font name (bold vs
 * regular) is available as a secondary signal but height alone is enough for
 * the common case.
 *
 * Ceiling (be honest about it): this is a strong heuristic, not a parser. It
 * still won't catch headings that are same-size-but-bold, ALL-CAPS body-size
 * headings, multi-column layouts, or scanned/image PDFs (no text layer at
 * all). Those need a real document-AI service — see textract.ts and the
 * factory. This extractor is the best you can do with zero external
 * dependencies, and it's genuinely usable in production for born-digital,
 * single-column policy PDFs.
 */

const HEADING_SIZE_RATIO = 1.12; // a line >12% larger than body is a heading
const SECTION_NUMBER = /^(\d+(?:\.\d+)*)[.)]?\s+(.*)$/;

interface Line {
  text: string;
  size: number;
}

interface PdfTextItem {
  str: string;
  height: number;
  hasEOL: boolean;
}

/** Groups pdfjs text items into visual lines with a representative font size. */
function itemsToLines(items: PdfTextItem[]): Line[] {
  const lines: Line[] = [];
  let buffer = "";
  let maxSize = 0;

  const flush = () => {
    const text = buffer.trim();
    if (text.length > 0) lines.push({ text, size: maxSize });
    buffer = "";
    maxSize = 0;
  };

  for (const item of items) {
    if (item.str.length > 0) {
      buffer += item.str;
      // Font height is 0 on the empty EOL marker items; ignore those.
      if (item.height > maxSize) maxSize = item.height;
    }
    if (item.hasEOL) flush();
  }
  flush();
  return lines;
}

/** The body font size = the most frequent line size (rounded to the point). */
function estimateBodySize(lines: Line[]): number {
  const counts = new Map<number, number>();
  for (const line of lines) {
    const key = Math.round(line.size);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let bodySize = 0;
  let best = -1;
  for (const [size, count] of counts) {
    if (count > best) {
      best = count;
      bodySize = size;
    }
  }
  return bodySize || 11;
}

function parseHeading(text: string): { sectionNumber: string | null; sectionTitle: string } {
  const match = SECTION_NUMBER.exec(text);
  if (match && match[2]!.trim().length > 0) {
    return { sectionNumber: match[1]!, sectionTitle: match[2]!.trim() };
  }
  return { sectionNumber: null, sectionTitle: text };
}

export const layoutAwareExtractor: PolicyExtractor = {
  name: "layout-aware",

  async extract(buffer: Buffer): Promise<ExtractedSection[]> {
    const doc = await getDocument({ data: new Uint8Array(buffer) }).promise;
    const allItems: PdfTextItem[] = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      for (const raw of content.items as PdfTextItem[]) {
        allItems.push({ str: raw.str, height: raw.height, hasEOL: raw.hasEOL });
      }
    }

    const lines = itemsToLines(allItems);
    if (lines.length === 0) return [];

    const bodySize = estimateBodySize(lines);
    const headingThreshold = bodySize * HEADING_SIZE_RATIO;

    const sections: ExtractedSection[] = [];
    let current: ExtractedSection | null = null;

    for (const line of lines) {
      const isHeading = line.size >= headingThreshold;
      if (isHeading) {
        if (current) sections.push(current);
        const { sectionNumber, sectionTitle } = parseHeading(line.text);
        current = { sectionNumber, sectionTitle, text: "" };
      } else if (current) {
        current.text = current.text.length > 0 ? `${current.text} ${line.text}` : line.text;
      }
      // Body text before the first heading (rare) is dropped — nothing to
      // attach it to as a citable section.
    }
    if (current) sections.push(current);

    // Drop the document-title "section" (a large heading with no body).
    return sections.filter((s) => s.text.trim().length > 0);
  },
};

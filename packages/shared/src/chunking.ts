/**
 * Chunking = "keep each embedded chunk under a token budget." It deliberately
 * does NOT decide where sections begin — that's the extractor's job (a layout
 * concern), kept separate so the chunker stays a pure, testable function over
 * already-segmented sections.
 *
 * Each chunk carries its section number/title as metadata so citations can be
 * precise ("General Liability Policy, §4.2") instead of "somewhere in this
 * 40-page PDF". Both are nullable: a real vendor PDF may have a heading with
 * no number, or a section the extractor found by layout with no clean title.
 *
 * `splitIntoSections` / `chunkPolicyText` remain as a simple regex-based path
 * over plain text — used by the unit tests and as the fallback extractor. The
 * production ingestion path uses the layout-aware extractor + `chunkSections`.
 */

const SECTION_HEADING = /^(\d+(?:\.\d+)?)\s+([A-Z][A-Za-z0-9 ,'/&-]*)$/;

const MAX_CHUNK_CHARS = 1200;
const OVERLAP_CHARS = 150;

export interface RawSection {
  sectionNumber: string | null;
  sectionTitle: string | null;
  text: string;
}

/** A section as produced by any extractor, before size-based chunking. */
export type ExtractedSection = RawSection;

export interface Chunk {
  sectionNumber: string | null;
  sectionTitle: string | null;
  text: string;
}

/** Splits an oversized section body into overlapping sub-chunks. */
function splitLongText(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text];

  const parts: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + MAX_CHUNK_CHARS, text.length);
    parts.push(text.slice(start, end));
    if (end === text.length) break;
    start = end - OVERLAP_CHARS;
  }
  return parts;
}

/**
 * Core chunker: sections in, size-bounded chunks out. Empty sections are
 * dropped (e.g. a document-title "section" the layout extractor produced with
 * no body text). This is the function the production ingestion path calls.
 */
export function chunkSections(sections: RawSection[]): Chunk[] {
  return sections
    .filter((s) => s.text.trim().length > 0)
    .flatMap((section) =>
      splitLongText(section.text.trim()).map((text) => ({
        sectionNumber: section.sectionNumber,
        sectionTitle: section.sectionTitle,
        text,
      })),
    );
}

/**
 * Simple regex-based section detection over plain text. Detects "N[.N]
 * Heading" lines. Kept as a fallback extractor and for unit testing the
 * chunker without a real PDF.
 */
export function splitIntoSections(pageText: string): RawSection[] {
  const lines = pageText.split("\n").map((l) => l.trim());
  const sections: RawSection[] = [];
  let current: RawSection | null = null;

  for (const line of lines) {
    if (line.length === 0) continue;
    const match = SECTION_HEADING.exec(line);
    if (match) {
      if (current) sections.push(current);
      current = { sectionNumber: match[1]!, sectionTitle: match[2]!.trim(), text: "" };
    } else if (current) {
      current.text = current.text.length > 0 ? `${current.text} ${line}` : line;
    }
    // Text before the first detected heading (e.g. the title line) is
    // intentionally dropped — it isn't a citable section.
  }
  if (current) sections.push(current);
  return sections;
}

/** Convenience: regex-extract sections from plain text, then chunk them. */
export function chunkPolicyText(pageText: string): Chunk[] {
  return chunkSections(splitIntoSections(pageText));
}

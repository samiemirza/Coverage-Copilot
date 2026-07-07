/**
 * Section-aware chunking for policy documents. Pure function, no I/O — takes
 * already-extracted plain text and returns one chunk per numbered section
 * (e.g. "4.2 Bodily Injury to Customers"), splitting oversized sections
 * further so no chunk blows past a token budget.
 *
 * This is what makes citations precise later ("General Liability Policy,
 * §4.2") instead of "somewhere in this 40-page PDF" — the section number and
 * heading ride along as metadata on every chunk.
 *
 * Known limitation (fine for this demo, not for production): it detects
 * section boundaries by regex-matching a "N[.N] Heading" line on its own
 * line. That works because these PDFs are synthetic and generated with one
 * heading per line. Real vendor policy PDFs have wildly inconsistent
 * formatting — production would need a layout-aware extractor (e.g. PDF
 * bookmarks/outline, or a tool like Unstructured) rather than text regex.
 */

const SECTION_HEADING = /^(\d+(?:\.\d+)?)\s+([A-Z][A-Za-z0-9 ,'/&-]*)$/;

const MAX_CHUNK_CHARS = 1200;
const OVERLAP_CHARS = 150;

export interface RawSection {
  sectionNumber: string;
  sectionTitle: string;
  text: string;
}

export interface Chunk {
  sectionNumber: string;
  sectionTitle: string;
  text: string;
}

/** Splits extracted policy text into one raw section per detected heading. */
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

/** Full pipeline: extracted text -> citable, size-bounded chunks. */
export function chunkPolicyText(pageText: string): Chunk[] {
  const sections = splitIntoSections(pageText);
  return sections.flatMap((section) =>
    splitLongText(section.text).map((text) => ({
      sectionNumber: section.sectionNumber,
      sectionTitle: section.sectionTitle,
      text,
    })),
  );
}

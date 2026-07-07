import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

interface TextItem {
  str: string;
  hasEOL: boolean;
}

/**
 * Extracts plain text from a PDF buffer, preserving line breaks (pdfjs
 * reports each visual line as a separate text item with a hasEOL flag —
 * without reconstructing newlines from that, section headings and body text
 * would run together into one unparseable blob).
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    let pageText = "";
    for (const item of content.items as TextItem[]) {
      pageText += item.str;
      if (item.hasEOL) pageText += "\n";
    }
    pageTexts.push(pageText);
  }

  return pageTexts.join("\n");
}

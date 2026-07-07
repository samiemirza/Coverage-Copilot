/**
 * One-off script: renders the synthetic policy content into real PDF binaries
 * so the ingestion pipeline extracts text from actual PDF files, not from
 * the source strings directly. Run once; the output PDFs are checked into
 * the repo as seed data (not regenerated on every ingest).
 *
 *   npm run generate-seed-pdfs --workspace packages/backend
 */
import { mkdirSync, createWriteStream } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { policies } from "./policy-content.js";

const outDir = path.join(import.meta.dirname, "policies");
mkdirSync(outDir, { recursive: true });

async function renderPolicy(policy: (typeof policies)[number]): Promise<void> {
  const doc = new PDFDocument({ margin: 54 });
  const outPath = path.join(outDir, policy.filename);
  const stream = createWriteStream(outPath);
  doc.pipe(stream);

  doc.fontSize(18).font("Helvetica-Bold").text(policy.title);
  doc.moveDown(1.5);

  for (const section of policy.sections) {
    doc.fontSize(13).font("Helvetica-Bold").text(`${section.number} ${section.heading}`);
    doc.moveDown(0.3);
    doc.fontSize(11).font("Helvetica").text(section.body, { align: "left" });
    doc.moveDown(1);
  }

  doc.end();
  // pdfkit writes the trailer/xref asynchronously on 'end' — the process
  // must not exit before the underlying file stream actually finishes,
  // or the PDF is truncated and unreadable by any parser.
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
  console.log(`Wrote ${outPath}`);
}

for (const policy of policies) {
  await renderPolicy(policy);
}

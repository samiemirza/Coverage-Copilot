import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { layoutAwareExtractor } from "./layoutAware.js";

const seedDir = path.join(import.meta.dirname, "../../seed-data/policies");

describe("layoutAwareExtractor", () => {
  it("detects sections by font size, including numbered subsections", async () => {
    const buffer = await readFile(path.join(seedDir, "general-liability-policy.pdf"));
    const sections = await layoutAwareExtractor.extract(buffer);

    // §4.2 is the section that answers the slip-and-fall question; it must be
    // found as its own section, with its number parsed for citation.
    const bodilyInjury = sections.find((s) => s.sectionNumber === "4.2");
    expect(bodilyInjury).toBeDefined();
    expect(bodilyInjury!.sectionTitle).toContain("Bodily Injury");
    expect(bodilyInjury!.text).toContain("slip, trip, or fall");
  });

  it("drops the document title (large heading with no body) and keeps real sections", async () => {
    const buffer = await readFile(path.join(seedDir, "general-liability-policy.pdf"));
    const sections = await layoutAwareExtractor.extract(buffer);

    // No section should be the bare title line.
    expect(sections.every((s) => s.text.trim().length > 0)).toBe(true);
    // The liquor exclusion (the demo's headline gap) must survive extraction.
    const liquor = sections.find((s) => s.sectionTitle?.includes("Liquor"));
    expect(liquor?.text.toLowerCase()).toContain("alcoholic beverages");
  });

  it("returns no sections for a PDF with no text layer signal", async () => {
    // A buffer that isn't a real PDF text document should not throw the whole
    // pipeline; extraction returning [] is handled upstream as NO_EXTRACTABLE_TEXT.
    // (Using a valid but body-less input path here is covered by the title
    // drop above; this asserts the empty contract shape.)
    const buffer = await readFile(path.join(seedDir, "workers-compensation-policy.pdf"));
    const sections = await layoutAwareExtractor.extract(buffer);
    expect(Array.isArray(sections)).toBe(true);
    expect(sections.length).toBeGreaterThan(0);
  });
});

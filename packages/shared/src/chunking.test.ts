import { describe, expect, it } from "vitest";
import { chunkPolicyText, splitIntoSections } from "./chunking.js";

const SAMPLE = `Commercial General Liability Policy — Jane's Kitchen LLC
1 Declarations
Named Insured: Jane's Kitchen LLC.
4.2 Bodily Injury to Customers
This policy covers bodily injury liability arising from a customer's slip, trip, or fall.
5.1 Liquor Liability Exclusion
This policy does NOT cover bodily injury arising out of serving alcoholic beverages.`;

describe("splitIntoSections", () => {
  it("drops text before the first heading and groups the rest by section", () => {
    const sections = splitIntoSections(SAMPLE);
    expect(sections).toHaveLength(3);
    expect(sections[0]).toMatchObject({ sectionNumber: "1", sectionTitle: "Declarations" });
    expect(sections[1]).toMatchObject({ sectionNumber: "4.2", sectionTitle: "Bodily Injury to Customers" });
    expect(sections[1]!.text).toContain("slip, trip, or fall");
  });

  it("does not merge two consecutive sections' bodies", () => {
    const sections = splitIntoSections(SAMPLE);
    const liquorSection = sections.find((s) => s.sectionNumber === "5.1");
    expect(liquorSection?.text).not.toContain("slip, trip, or fall");
    expect(liquorSection?.text).toContain("alcoholic beverages");
  });
});

describe("chunkPolicyText", () => {
  it("produces one chunk per section for normal-length sections", () => {
    const chunks = chunkPolicyText(SAMPLE);
    expect(chunks).toHaveLength(3);
    expect(chunks.every((c) => c.text.length > 0)).toBe(true);
  });

  it("splits an oversized section into overlapping sub-chunks", () => {
    const longBody = "word ".repeat(400); // ~2000 chars, over the 1200 budget
    const text = `1 Declarations\n${longBody}`;
    const chunks = chunkPolicyText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.sectionNumber === "1")).toBe(true);
  });
});

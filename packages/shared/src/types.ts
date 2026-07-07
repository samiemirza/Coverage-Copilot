/**
 * Core entity shapes mirroring the Postgres data model in
 * coverage-copilot-build-spec.md §5. Kept here so the GraphQL resolvers,
 * Temporal activities, and (later) the MCP server all agree on one shape
 * instead of drifting into per-package copies.
 */

export interface Business {
  id: string;
  name: string;
  industry: string;
  naicsCode: string | null;
  profile: Record<string, unknown>;
  createdAt: string;
}

export interface Policy {
  id: string;
  businessId: string;
  filename: string;
  storageUrl: string;
  uploadedAt: string;
}

export interface PolicyChunk {
  id: string;
  policyId: string;
  chunkText: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export type RiskReviewStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface CoverageGap {
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
}

export interface RiskReview {
  id: string;
  businessId: string;
  status: RiskReviewStatus;
  temporalWorkflowId: string | null;
  result: { gaps: CoverageGap[]; summary: string } | null;
  createdAt: string;
}

# Coverage Copilot — Build Spec (for Claude Code)

An AI insurance assistant for small businesses. Built to mirror Glow's actual product surface
(coverage intelligence, risk advisory, pre-underwriting, 24/7 support) in Glow's exact stack.

> **How to use this file:** Open Claude Code in an empty repo and work through the milestones
> in order. Ask Claude Code to build one milestone at a time, review its output, and only move on
> once the milestone's "Done when" check passes. Keep a running `DECISIONS.md` noting anywhere you
> caught Claude Code making a wrong assumption — you'll want those stories for the interview.

---

## 1. Goal

A small-business owner (persona: "Jane," a 20-person restaurant) uploads their current policy
documents and a short business profile. The system:

1. **Coverage Q&A (RAG):** Answers plain-language questions ("Am I covered if a customer slips?")
   with grounded, cited answers pulled from the uploaded policies.
2. **Risk Review (durable agentic workflow):** Classifies the business by class/NAICS code, checks
   coverage against a baseline for that class, flags gaps, and produces a structured pre-quote /
   risk summary.

Everything is surfaced in a React + TypeScript dashboard via a GraphQL API.

## 2. Stack (non-negotiable — this is the point of the project)

- **Backend:** Node.js + TypeScript
- **API:** GraphQL (Apollo Server or GraphQL Yoga)
- **DB:** PostgreSQL + `pgvector` (app data + embeddings). Supabase or AWS RDS both fine.
- **Durable workflows:** Temporal (TypeScript SDK)
- **LLM:** Anthropic via the **Vercel AI SDK** (`generateObject`, `streamText`, tool calling) — or the Anthropic TS SDK directly. Use Claude for generation.
- **Embeddings:** any embeddings model; set the `pgvector` column dimension to match (e.g. 1536).
- **Frontend:** React + TypeScript (Vite). Chat UI + risk dashboard.
- **Infra:** Docker; GitHub Actions CI; deploy to AWS (App Runner or ECS/Fargate + RDS).

## 3. MVP scope (keep it finishable)

- **One** sample business (restaurant, echoing Jane) + 2–3 sample/synthetic policy PDFs.
- ~8 seed coverage questions.
- Class-code classification limited to a small known set with a hardcoded rules/baseline table
  for gap detection. It does **not** need to be real underwriting — it must demonstrate the pattern.
- **One** Temporal workflow with 3–4 activities.
- Clean but minimal frontend.

## 4. Architecture & data flow

```
Upload PDF ──► Ingestion (chunk + embed) ──► pgvector
                                              │
Owner asks question ──► GraphQL ──► RAG (retrieve + Claude, streamed) ──► cited answer
                                              │
Start Risk Review ──► GraphQL ──► Temporal Workflow
        └─ activity: classifyBusiness (Claude tool call → structured)
        └─ activity: retrievePolicyContext (RAG over chunks)
        └─ activity: detectCoverageGaps (Claude + rules table → structured)
        └─ activity: generateRiskSummary (structured) ──► persisted ──► dashboard
```

## 5. Data model (Postgres)

- `businesses(id, name, industry, naics_code, profile jsonb, created_at)`
- `policies(id, business_id, filename, storage_url, uploaded_at)`
- `policy_chunks(id, policy_id, chunk_text, embedding vector(1536), metadata jsonb)`
- `risk_reviews(id, business_id, status, temporal_workflow_id, result jsonb, created_at)`
- (optional) `coverage_answers(id, business_id, question, answer, citations jsonb, created_at)`

Index the embedding column (`ivfflat` or `hnsw`).

## 6. GraphQL schema (sketch)

```graphql
type Business { id: ID!, name: String!, naicsCode: String, policies: [Policy!]! }
type Policy { id: ID!, filename: String!, uploadedAt: String! }
type Citation { policyId: ID!, chunkId: ID!, snippet: String! }
type CoverageAnswer { answer: String!, citations: [Citation!]! }
type CoverageGap { title: String!, description: String!, severity: String! }
type RiskReview { id: ID!, status: String!, gaps: [CoverageGap!], summary: String }

type Query {
  business(id: ID!): Business
  riskReview(id: ID!): RiskReview
}
type Mutation {
  createBusiness(name: String!, industry: String!): Business!
  ingestPolicy(businessId: ID!, file: Upload!): Policy!
  askCoverageQuestion(businessId: ID!, question: String!): CoverageAnswer!  # streamed
  startRiskReview(businessId: ID!): RiskReview!   # returns immediately with status=RUNNING
}
```

## 7. Temporal workflow

`RiskReviewWorkflow(businessId)`:
1. `classifyBusiness` — Claude tool call returning `{ naicsCode, classCode, confidence }` (structured).
2. `retrievePolicyContext` — RAG retrieval of the business's policy chunks.
3. `detectCoverageGaps` — Claude + baseline rules table → `CoverageGap[]` (structured).
4. `generateRiskSummary` — structured summary; persist to `risk_reviews.result`.

Configure sensible retries + timeouts per activity. Persist `temporal_workflow_id` so the
dashboard can poll status. In the interview, be ready to explain **why Temporal** over cron/queues:
durability, automatic retries, long-running + stateful, human-in-the-loop, and workflow visibility —
all of which fit "monitor payroll, class codes, audits, claims trends."

## 8. LLM integration notes

- Use **structured outputs** everywhere it matters (classification, gaps, summary) with **Zod**
  schemas via the Vercel AI SDK's `generateObject`. On validation failure, retry with a repair
  prompt; log the failure. This is your "reliable in a high-stakes domain" story.
- Stream the coverage Q&A answer (`streamText`) and return citations alongside.
- Ground every answer: never answer coverage questions without retrieved policy context; if nothing
  relevant is retrieved, say so rather than guess (reuse your HealthSync guardrails instinct).

## 9. Eval harness (your differentiator — do not skip)

Create `evals/` with small labeled fixtures and an `npm run eval` script that reports:
- **Retrieval:** hit@k — did the correct chunk get retrieved for each seed question?
- **Citation accuracy:** did the answer cite the chunk that actually supports it?
- **Structured-output validity:** % of businesses where classification/gap/summary JSON passes Zod.
- **Gap detection:** precision/recall on the small labeled set.

Wire `npm run eval` into GitHub Actions so it runs on every PR. This directly answers the JD's
"reliable, measurable, production-ready" and ties to your CSaLT eval background.

## 10. Milestones (build in this order)

1. **Scaffold** — TS monorepo (backend + frontend), Docker Compose with Postgres+pgvector, seed data.
   *Done when:* `docker compose up` gives a running DB + hello-world GraphQL + React app.
2. **Ingestion** — PDF chunking + embeddings + write to `policy_chunks`.
   *Done when:* a seeded PDF produces retrievable chunks.
3. **Coverage Q&A** — GraphQL `askCoverageQuestion` with streamed, cited RAG answers.
   *Done when:* seed questions return grounded answers with correct citations.
4. **Temporal** — worker + `RiskReviewWorkflow` + 4 activities; `startRiskReview` mutation.
   *Done when:* a review runs end-to-end and persists structured gaps + summary.
5. **Dashboard** — React chat + risk-review view (gaps, severity, summary).
   *Done when:* full flow works from the browser.
6. **Evals + CI** — eval harness + GitHub Actions.
   *Done when:* `npm run eval` prints metrics and runs in CI.
7. **Deploy** — AWS (App Runner/ECS + RDS). Even a minimal deploy closes the AWS gap.
   *Done when:* there's a live URL.

## 11. Stretch: MCP server (optional second project)

A TypeScript MCP server exposing `lookup_class_code`, `check_coverage_gap`, `summarize_policy`
that **reuse the flagship's tool logic**. Hits the "MCP servers / agent tooling" nice-to-have and
the Claude-ecosystem signal. Talking point: "the same tools power both a GraphQL API and an MCP
agent interface."

## 12. Interview prep — keep notes while building

- Why Temporal vs cron/queues for underwriting/risk workflows.
- How structured outputs + Zod + repair-on-failure make the system reliable in a regulated domain.
- RAG groundedness / citation strategy / hallucination control (bridge from HealthSync guardrails).
- Your eval methodology and what the numbers told you (bridge from CSaLT).
- 2–3 concrete moments you caught Claude Code being wrong and fixed it (the JD prizes this exact judgment).
- One honest "what I'd harden for real production" list: cost, latency, PII handling, where it could be wrong.

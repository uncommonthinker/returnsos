# ReturnBrain — GitHub Documentation Checklist

A complete list of `.md` files for the repository, organized by priority. "Must Have" files are what Damco's reviewer will actually open in the 5-day code review window. "Should Have" and "Nice to Have" round out a professional repo but won't make or break the evaluation.

---

## Must Have — Reviewer Will Open These

### 1. `README.md` (repo root)
**The single most important file.** This is the front door — assume the reviewer reads this and nothing else unless it makes them curious.

Criteria:
- One-paragraph elevator pitch: what ReturnBrain is and what problem it solves
- The core input → output example (device record → disposition recommendation) shown as a code block, so the value is visible in 10 seconds
- Link to the video walkthrough (YouTube unlisted link)
- Link to the architecture doc and the live demo (if deployed) or local setup instructions
- Quick architecture diagram or ASCII sketch — even a simple one beats none
- Tech stack badges/list (FastAPI, React, PostgreSQL, RabbitMQ, Claude API)
- "Status" section: what's implemented vs. what's design-only — be explicit, this maps directly to the "self-awareness" criterion
- Repository structure overview (which folder is which service)
- License

---

### 2. `ARCHITECTURE.md`
Already drafted as your System Architecture Document — adapt to markdown for in-repo viewing.

Criteria:
- High-level component diagram (Mermaid diagram renders natively on GitHub — use this instead of an image where possible)
- One paragraph per service explaining its responsibility
- The event catalog table (DeviceIntaked, RulesEvaluated, DecisionReady, OutcomeLogged)
- Data flow walkthrough — the six-step decision flow
- Technology stack table with rationale column
- Must be skimmable in under 3 minutes — use headers liberally, this is a reference doc not a narrative

---

### 3. `DECISIONS.md` (or `docs/adr/` folder with one file per ADR)
Your Architecture Decision Records, either combined or split.

Criteria:
- Each ADR follows: Context → Decision → Rationale → Consequences (including negatives)
- At minimum cover: FastAPI choice, RabbitMQ vs Kafka, Claude as LLM provider, Rules-before-AI ordering, PostgreSQL-only persistence
- Each ADR should be short enough to read in 60–90 seconds
- If split into multiple files, number them (`001-fastapi-backend.md`, `002-rabbitmq-event-bus.md`, etc.) and link them from an index
- This is the document that most directly proves "architecture decisions" and "tradeoffs" — Track B criteria

---

### 4. `LIMITATIONS.md`
Your Edge Cases, Limitations & Tradeoffs document.

Criteria:
- Explicit "What Doesn't Work" section near the top — don't bury it
- Table format: limitation → business impact → planned resolution (v2/v3)
- Documented edge cases with expected system behavior (conflicting signals, swollen battery, missing market data)
- Tone: confident and matter-of-fact, framed as scoping decisions, not apologies
- This document directly answers the "What's Broken" section of the video brief — make it easy for a reviewer to find without watching the video

---

### 5. `SETUP.md` or `docs/GETTING_STARTED.md`
Even if the system isn't fully implemented, this shows engineering maturity.

Criteria:
- Prerequisites (Node version, Python version, Docker)
- `docker-compose up` instructions if using Docker Compose for local dev
- Environment variables required (`.env.example` file should accompany this)
- How to run each service individually if not using Docker
- How to seed sample device records for testing
- How to run tests (even if minimal)
- If parts are design-only (not implemented), say so explicitly here too — consistency with README's "Status" section matters

---

## Should Have — Strengthens the Submission

### 6. `API.md` or `docs/API.md`
Your Data Model & API Specification document, in markdown.

Criteria:
- Endpoint table: method, path, description, auth requirement — grouped by service
- At least 2–3 full request/response JSON examples (intake request, decision response)
- Link to OpenAPI/Swagger docs if FastAPI's auto-generated docs are exposed
- Error response format documented (RFC 7807 if that's what you're using)

---

### 7. `AI_DESIGN.md`
Your AI Agent Design & Prompt Engineering Spec.

Criteria:
- The four-agent pipeline explained with input/output for each agent
- The actual system prompt included as a code block (this is a strong signal of "AI-native execution")
- Confidence calibration table
- Failure mode → recovery table for the AI layer specifically
- This is the document most likely to differentiate you from "I called an LLM API once" submissions

---

### 8. `CHANGELOG.md`
Even a sparse one signals process discipline.

Criteria:
- Follows [Keep a Changelog](https://keepachangelog.com) format loosely: `## [Unreleased]`, `### Added`, `### Changed`
- Entries can be coarse-grained ("Added Rules Engine service scaffold") — doesn't need to be commit-level
- Shows the build evolved iteratively, which supports "how you think" evaluation

---

### 9. `CONTRIBUTING.md`
Signals the project is built to be maintained, not just demoed.

Criteria:
- Branching convention (even if simple — `main` + feature branches)
- Code style / linting setup (e.g., `ruff` for Python, `eslint` for frontend)
- How to run tests before submitting a PR
- Keep this short — half a page is enough; over-engineering this for a take-home challenge would itself be a (minor) signal of misjudged scoping

---

### 10. `docs/ROADMAP.md`
Your v1 / v2 / v3 breakdown from the deck, expanded slightly.

Criteria:
- Clear version boundaries with rough timelines
- Each v2/v3 item should trace back to a specific limitation in `LIMITATIONS.md` — cross-link them
- Avoid vague items ("improve AI") — every roadmap item should be concrete and scoped (e.g., "Computer vision model for cosmetic grading from intake photos")

---

## Nice to Have — Polish, Lower Priority

### 11. `docs/DATA_MODEL.md`
If you split this out from `API.md` for length reasons.

Criteria:
- ER diagram as Mermaid (`erDiagram` syntax renders on GitHub)
- One table per entity with column, type, constraints, description
- Note which fields are JSONB and why (rules conditions, reasoning chains)

---

### 12. `SECURITY.md`
Standard GitHub-recognized file (shows up in the repo's "Security" tab).

Criteria:
- How to report a vulnerability (even if it's just "open an issue" for a challenge project)
- Brief note on what's encrypted, what's not, and what's out of scope for v1 (e.g., "PII encryption is designed but not implemented in this prototype")

---

### 13. `docs/GLOSSARY.md`
Optional but useful given the domain-specific vocabulary (disposition, recovery value, grading, etc.)

Criteria:
- Short definitions for: disposition actions (RESELL, REFURBISH, REPAIR, PARTS, RECYCLE, DESTROY), condition grades (A–F), confidence bands, hard vs. soft rules
- Helps a non-domain-expert reviewer (likely scenario for Track B) follow the architecture docs without re-explaining terms inline everywhere

---

### 14. `docs/PRD.md`
Your full Product Requirements Document — useful as a reference but lowest priority for in-repo placement since architecture and limitations docs cover the "thinking" criteria more directly.

Criteria:
- Functional requirements table with priority levels
- Success metrics table (Recovery Value %, throughput, etc.)
- Personas / target users section
- Place this under `docs/` rather than repo root — it's reference material, not something a reviewer needs on first open

---

## Recommended Repo Structure

```
returnbrain/
├── README.md                  ← Must Have #1
├── ARCHITECTURE.md             ← Must Have #2
├── DECISIONS.md                ← Must Have #3 (or docs/adr/*.md)
├── LIMITATIONS.md               ← Must Have #4
├── SETUP.md                    ← Must Have #5
├── CHANGELOG.md                ← Should Have #8
├── CONTRIBUTING.md              ← Should Have #9
├── SECURITY.md                 ← Nice to Have #12
├── .env.example
├── docker-compose.yml
├── docs/
│   ├── API.md                  ← Should Have #6
│   ├── AI_DESIGN.md             ← Should Have #7
│   ├── ROADMAP.md               ← Should Have #10
│   ├── DATA_MODEL.md            ← Nice to Have #11
│   ├── GLOSSARY.md              ← Nice to Have #13
│   ├── PRD.md                   ← Nice to Have #14
│   └── adr/
│       ├── 001-fastapi-backend.md
│       ├── 002-rabbitmq-event-bus.md
│       ├── 003-claude-llm-provider.md
│       ├── 004-rules-before-ai.md
│       └── 005-postgresql-only.md
├── services/
│   ├── device-service/
│   ├── rules-engine/
│   ├── ai-decision-service/
│   ├── valuation-service/
│   └── analytics-service/
└── frontend/
```

---

## Priority If Time-Constrained

If the 5-day window is tight, this is the minimum viable documentation set, in order:

1. `README.md` — non-negotiable, first impression
2. `LIMITATIONS.md` — directly maps to "self-awareness" criterion
3. `DECISIONS.md` / ADRs — directly maps to "architecture decisions" and "tradeoffs" criteria
4. `ARCHITECTURE.md` — directly maps to "technical understanding" and "scoping"
5. `SETUP.md` — even a partial one shows the project is real, not just slides

Everything else can be added incrementally or referenced as "available on request" in the README without penalty — the four design docs you already have (PRD, Data Model & API, AI Design) can be linked as PDFs in `docs/` if converting them all to markdown isn't worth the time investment.

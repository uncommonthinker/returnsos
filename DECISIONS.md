# Architecture Decision Records (ADRs)

## ADR 001: FastAPI Backend
* **Context**: Need a backend framework to serve REST APIs and stream events to the React frontend.
* **Decision**: Selected FastAPI (Python).
* **Rationale**: Python is the lingua franca for AI orchestration. FastAPI provides high performance, automatic OpenAPI documentation, and native async support required for SSE streaming.
* **Consequences**: Fast development cycle, easy LLM integration.

## ADR 002: Server-Sent Events (SSE) vs WebSockets
* **Context**: Need to stream real-time Kafka-like events to the UI.
* **Decision**: Use Server-Sent Events (SSE).
* **Rationale**: Since our event visualizer is read-only (streaming event logs from backend to frontend), SSE is lighter, operates over standard HTTP, and has automatic reconnection out-of-the-box. WebSockets would only be needed if we required two-way real-time communication.
* **Consequences**: Simplified infrastructure, easier firewall traversal.

## ADR 003: SQLite vs PostgreSQL
* **Context**: Storing device records, rules, and audit logs.
* **Decision**: Utilize SQLite locally.
* **Rationale**: While Postgres is the enterprise choice, SQLite requires zero setup for a reviewer, preventing configuration overhead. 
* **Consequences**: In production, we swap the SQLAlchemy connection string from `sqlite:///` to `postgresql://` with no code changes.

## ADR 004: Rules-Before-AI Ordering
* **Context**: Validating safety hazards (e.g. swollen batteries) and financial rules.
* **Decision**: Hardcoded rules engines run *before* AI agent evaluation.
* **Rationale**: AI models can hallucinate. Deterministic business rules must act as a hard boundary. If a device has a swollen battery, the rules engine quarantines it before the AI ever sees it.
* **Consequences**: Absolute safety guarantees, lower LLM token usage.

## ADR 005: Mock AI Engine for Review
* **Context**: Providing an AI-driven platform for offline evaluation.
* **Decision**: Build a mock AI engine alongside the Gemini integration.
* **Rationale**: In an enterprise trial, API keys might be restricted, expired, or blocked. The mock engine ensures the application works immediately with realistic data.
* **Consequences**: Easy to review and test locally without incurring cloud costs.

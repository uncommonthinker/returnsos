# ReturnsOS Product Roadmap

## v1: The Decision Intelligence Prototype (Current)
- [x] Basic Rules Engine (Lowest-grade rule, Lock checks).
- [x] Event Streaming (SSE) to Web and Mobile UIs.
- [x] Base Valuation Matrix Configuration.
- [x] AI Recommendation Simulation.

## v2: Hardware & Live AI Integration
*Addresses limitations in `LIMITATIONS.md`: "Mock AI Responses" and "Manual Diagnostics"*
- Wire up the official `google-genai` SDK in the backend FastAPI service.
- Integrate with diagnostic cable APIs (e.g., PhoneCheck) to eliminate manual data entry.
- Implement OCR to automatically grade cosmetic conditions from intake photos.

## v3: Enterprise Scale
*Addresses limitation: "Single Database"*
- Migrate from local SQLite to managed PostgreSQL.
- Introduce actual RabbitMQ or Kafka brokers instead of in-memory SSE simulation.
- RBAC (Role-Based Access Control) using JWT tokens for Operators vs Supervisors.

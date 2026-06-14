# Security Policy

## Reporting a Vulnerability
As this is currently a prototype built for a technical challenge, please open a GitHub Issue for any identified security flaws.

## Out of Scope (MVP)
The following are intentionally excluded from v1 but planned for enterprise scale:
- PII Encryption at rest (customer shipping data is currently not captured).
- JWT Authentication / RBAC boundaries between operator and supervisor APIs.
- API Key rotation policies for the LLM.

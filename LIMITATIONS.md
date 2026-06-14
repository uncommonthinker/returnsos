# Edge Cases, Limitations & Tradeoffs

## What Doesn't Work (Current Scope Boundaries)
* **Live LLM Integration**: The Gemini AI integration is currently simulated using a mock engine to ensure the application runs out-of-the-box without requiring API keys or incurring costs during review.
* **Physical Hardware Integration**: We do not currently interface with diagnostic cables (e.g., PhoneCheck) to pull automated diagnostic data.
* **Multi-user Auth**: Role-Based Access Control (RBAC) is mocked via UI tabs (Operator vs. Supervisor) rather than JWT tokens.

## Limitation Roadmap
| Limitation | Business Impact | Planned Resolution (v2/v3) |
|------------|-----------------|----------------------------|
| Mock AI Responses | Cannot adapt to unstructured data | Wire up the `google-genai` SDK in backend |
| Manual Diagnostics | Operator data entry errors | Integrate with diagnostic hardware APIs |
| Single Database | Scalability bottleneck | Migrate to PostgreSQL and separate Read/Write replicas |

## Known Edge Cases
1. **Conflicting Signals**: If an operator enters "Cosmetic Grade A" but leaves a note saying "deep scratch", the system currently relies on the Grade A selection. *Resolution: AI Audit Agent will parse notes to downgrade conflicting manual entries.*
2. **Missing Market Data**: If a new phone model is intaked without a base value in the Policy Rules, the Valuation Service defaults to $0, flagging it for Supervisor Review.
3. **Swollen Battery Hazard**: Overrides all other paths and instantly quarantines the device for hazmat recycling, bypassing any profitability checks.

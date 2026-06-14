# AI Agent Design & Prompt Engineering Spec

ReturnsOS uses a multi-agent "Decision Intelligence" architecture to evaluate devices. 

## The Four-Agent Pipeline

1. **Condition Assessment Agent**: Evaluates raw diagnostic signals (grades, notes, lock statuses).
2. **Recovery Valuation Agent**: Queries the active Policy Rules to calculate base market value minus itemized repair deductions.
3. **Disposition Recommendation Agent**: Blends business logic with valuation to propose the highest-yield path (Resell, Repair, Parts, Recycle).
4. **Audit Agent**: Acts as the ultimate safety checker, ensuring no locked or hazardous devices are recommended for resell.

## System Prompt Example (Disposition Agent)
```text
You are the Disposition Recommendation Agent.
Given the following device assessment and valuation data, recommend the optimal disposition path.
Paths: [RESELL, REPAIR, REFURBISH, PARTS, RECYCLE]

Rules:
1. If Battery Swollen == true, immediately output RECYCLE.
2. If RVP (Recovery Value Percentage) < 40%, output PARTS or RECYCLE.
3. If Functional Grade is A and Cosmetic is A, output RESELL.

Device Data: {device_data_json}
```

## Failure Mode & Recovery
| Failure Mode | Detection | Recovery Strategy |
|--------------|-----------|-------------------|
| Hallucinated Output Format | JSON parser throws exception | Fallback to default `RECYCLE` path and flag for supervisor review. |
| Over-optimistic Valuation | Valuation Agent estimates RVP > 100% | Audit Agent caps RVP at 95% and flags rule anomaly. |
| API Rate Limit | Cloud LLM provider returns 429 | System switches to deterministic local rules engine until quota resets. |

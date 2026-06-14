# Data Model

## Entity Relationship Diagram

```mermaid
erDiagram
    SystemSetting {
        string key PK
        string value "JSONB"
        datetime updated_at
    }

    Device {
        int id PK
        string serial_number
        string model
        string brand
        string sim_lock
        string fmip_lock
        string mdm_lock
        string carrier_lock
        int battery_health
        boolean battery_swollen
        string cosmetic_grade
        string cosmetic_details
        string functional_grade
        string functional_details
        string status
        datetime created_at
    }

    DispositionDecision {
        int id PK
        int device_id FK
        string recommended_action
        float confidence
        float estimated_recovery_value
        string reasoning_json "JSONB"
        string financial_matrix_json "JSONB"
        string final_grade
        boolean is_gemini_processed
        datetime created_at
    }

    DispositionDecision ||--o{ Device : "has"
```

## JSONB Fields
We use JSON stringified text (effectively JSONB in Postgres) for rules and reasoning:
1. `SystemSetting.value`: Stores dynamic policy objects like base prices and multipliers.
2. `DispositionDecision.reasoning_json`: Stores the varied outputs of the 4 AI Agents for transparency.

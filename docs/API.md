# Data Model & API Specification

## Service Endpoints

### Device Service
| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/devices` | List all processed and pending devices. | None (MVP) |
| POST | `/api/devices` | Ingest a new device record. | None (MVP) |
| POST | `/api/devices/{id}/action` | Supervisor override (approves or rejects a device path). | None (MVP) |

### Settings / Rules Service
| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/settings` | Retrieve active policy rules and multipliers. | None (MVP) |
| POST | `/api/settings/{key}` | Update a specific rule key or base value matrix. | None (MVP) |

### Analytics Service
| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/analytics` | Returns RVP, Volume, and daily recovery trends. | None (MVP) |

## Example Request/Response

### Ingest Device Request
**POST** `/api/devices`
```json
{
  "serial_number": "IMEI-849201",
  "model": "iPhone 13",
  "brand": "Apple",
  "battery_health": 88,
  "battery_swollen": false,
  "cosmetic_grade": "A",
  "functional_grade": "B"
}
```

### Device Decision Response
**GET** `/api/devices/1`
```json
{
  "id": 1,
  "serial_number": "IMEI-849201",
  "status": "PENDING_REVIEW",
  "decision": {
    "recommended_action": "REPAIR",
    "confidence": 0.92,
    "estimated_recovery_value": 310.50,
    "final_grade": "B"
  }
}
```

# ReturnsOS

ReturnsOS is a decision intelligence layer and reverse logistics platform for electronics retail and insurance. When a device enters a processing center, operators rely on tribal knowledge. ReturnsOS standardizes evaluation rules and uses multi-agent AI to maximize the value recovered from every returned asset.

## ⚡ Input → Output Example
```json
// Input (Device Record)
{ "brand": "Apple", "model": "iPhone 14 Pro", "functional_grade": "C", "cosmetic_grade": "B", "battery_swollen": false, "mdm_lock": "UNLOCKED" }

// Output (Decision Recommendation)
{ "recommended_action": "REPAIR", "estimated_recovery_value": 430.00, "confidence": 0.94 }
```

## 🎥 Demos & Links
- **[ReturnsOS Pitch & Video Script](https://drive.google.com/drive/folders/13IqGq8uEH69FhdzqTuSTT3jwMzfIUVO3?usp=sharing)**
- **[System Architecture](ARCHITECTURE.md)**

## 🏗️ Architecture Sketch
```text
[ Operator Console ]  →  [ FastAPI Gateway ]  →  [ Rules Engine ]
[ Supervisor Mobile]  ←  [ Event Bus (SSE) ]  ←  [ AI Agents ]
```

## 🛠️ Tech Stack
* **Frontend:** React, Vite
* **Backend:** FastAPI, Python
* **Database:** SQLite (PostgreSQL ready)
* **Events:** Server-Sent Events (SSE)
* **AI Provider:** Google Gemini Pro

## 📊 Status
- **Implemented:** React UI, FastAPI Backend, Rules Engine, Valuation Matrix, Event Streaming, Mobile Flow, Rule Configurator.
- **Design-only / Stubbed:** Gemini API integration (currently simulated via mock engine for ease of review), RabbitMQ (simulated via SSE).

## 📁 Repository Structure
* `frontend/` - React application
* `backend/` - FastAPI application and SQLite DB
* `docs/` - Comprehensive technical specifications

## 📜 License
MIT

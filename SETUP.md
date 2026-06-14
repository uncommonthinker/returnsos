# Getting Started

Follow these steps to run ReturnsOS locally.

## Prerequisites
- **Node.js** (v18+)
- **Python** (v3.9+)

## 1. Start the Backend (FastAPI)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn app.main:app --reload
```
The backend will run on `http://localhost:8000`.

## 2. Start the Frontend (React)
Open a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
The frontend will run on `http://localhost:5173`.

## Environment Variables
Currently, no external `.env` files are required since the application uses SQLite and a mock AI engine to ensure zero-configuration startup.

## Testing
- **Backend Tests**: Run `pytest` inside the `backend` directory.
- **Seeding Data**: The backend automatically seeds initial test data (e.g., standard market values and mock devices) into the SQLite database on startup.

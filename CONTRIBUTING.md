# Contributing to ReturnsOS

## Branching Strategy
We follow a simple feature-branch workflow:
- `main` is always deployable.
- Create feature branches: `feature/your-feature-name` or `bugfix/issue-description`.
- Open a Pull Request against `main`.

## Local Development Setup
1. Backend requires `python 3.9+`. Run `pip install -r requirements.txt` and start with `uvicorn app.main:app`.
2. Frontend requires `Node 18+`. Run `npm install` and `npm run dev`.

## Code Style
- **Python**: We use `black` for formatting and `flake8` for linting.
- **React**: We use `eslint` with standard React plugins.

## Submitting a PR
Ensure the frontend compiles cleanly (`npm run build`) and the backend tests pass (`pytest`) before requesting review.

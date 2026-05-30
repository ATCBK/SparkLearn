# SparkLearn Desktop

SparkLearn Desktop uses Electron to run the local frontend and backend together on the user's machine.

Local services:

1. `frontend`: Next.js on `127.0.0.1:3000`.
2. `backend`: FastAPI on `127.0.0.1:8000`.
3. The Electron window loads the existing Next.js pages.

## Development

```powershell
cd D:\Project_building\SparkLearn\desktop
npm install
npm run doctor
npm run dev
```

Startup order:

1. Start `backend` and wait for `http://127.0.0.1:8000/health`.
2. Start `frontend` and wait for `http://127.0.0.1:3000`.
3. Open the desktop window.

## Configuration

Default config is in `config/desktop.config.example.json`.

For local overrides, create `config/desktop.config.json`. This file should not be committed.

## Validation

Frontend:

```powershell
cd D:\Project_building\SparkLearn\frontend
npx playwright test --project=desktop-chromium --project=mobile-chromium
```

Backend:

```powershell
cd D:\Project_building\SparkLearn\backend
python -m pytest tests\test_api.py -q
```

## Logs

Desktop logs are written under Electron `userData/logs`, usually:

```text
%APPDATA%\sparklearn-desktop\logs
```

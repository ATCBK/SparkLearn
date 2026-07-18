# SparkLearn Desktop

SparkLearn Desktop uses Electron to run the local frontend and backend together on the user's machine.

Local services:

1. `frontend`: Next.js on `127.0.0.1:3000`.
2. `backend`: FastAPI on `127.0.0.1:8000`.
3. The Electron window loads the existing Next.js pages.

StudyBuddy uses the local Nanobot runtime. Desktop only provides a configuration
entry and does not replace Nanobot's own Feishu/channel/agent logic.

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

For a lightweight judge/demo package, deploy the web frontend and API backend on
the server, then copy `config/desktop.config.server.example.json` to
`config/desktop.config.json`. Replace:

- `https://your-sparklearn-web.example.com` with the deployed frontend origin.
- `https://your-sparklearn-api.example.com` with the deployed backend origin.

This mode disables local frontend/backend services and opens the server frontend
inside the desktop window.

If you want to run the local frontend while connecting it to a deployed backend,
keep `frontend.enabled` as `true`, set `backend.enabled` to `false`, and set
`NEXT_PUBLIC_API_BASE_URL` to the deployed backend origin.

You can also use environment variables without writing a local config file:

```powershell
$env:SPARKLEARN_FRONTEND_URL="https://your-sparklearn-web.example.com"
$env:SPARKLEARN_API_BASE_URL="https://your-sparklearn-api.example.com"
$env:SPARKLEARN_DESKTOP_FRONTEND_ENABLED="false"
$env:SPARKLEARN_DESKTOP_BACKEND_ENABLED="false"
npm run dev
```

StudyBuddy configuration is available from the desktop menu:

```text
SparkLearn -> StudyBuddy 配置
```

The window reads and writes the project Nanobot config path from
`NANOBOT_CONFIG_PATH`, or falls back to:

```text
nanobot-main\.nanobot\config.json
```

Use this screen to set the StudyBuddy model provider, model, API key, workspace,
and Nanobot channel configuration.

Current UI flow:

1. Set model and local service basics.
2. Choose the target channel inside the StudyBuddy page.
3. Fill the channel form or edit raw `channels` JSON for advanced fields.
4. Save, then restart Nanobot to apply the new configuration.

The desktop shell also starts `nanobot gateway` automatically on launch so
Feishu stays connected without a manual startup step.

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

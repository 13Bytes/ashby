# Ashby Plot Builder

Browser-based editor for the Ashby `config.json` workflow with a live plot preview.

## Features

- Config editor for dataframe, frame, axis, layer, annotation, guideline, and color settings.
- Live plot preview rendered by the Python backend.
- `POST /api/render-plot` endpoint that accepts the full JSON config, returns the generated image, and exposes non-fatal plot messages back to the frontend preview.
- `POST /api/import-database` endpoint for spreadsheet column discovery and cached upload handling.
- JSON import/export and in-app JSON editor.
- Source management for Excel uploads and Teable-based data sources.

## Development

```bash
npm install
npm run dev
```

### Backend (FastAPI)

The backend is a web server and must be started with Uvicorn (running `backend/app.py` directly will exit immediately after import). Start it in a second terminal:

```powershell
python -m venv backend\.venv
backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
backend\.venv\Scripts\python -m uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
```

You can also use the npm shortcut once the backend environment is active:

```powershell
npm run backend
```

### Frontend/backend URLs

- Frontend dev server: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:8000`
- The Vite dev server proxies `/api/*` requests to the backend.

## Validation

```powershell
npm run build
npm run lint
```

## Tests

The repository includes two lightweight automated test suites:

- Frontend contract tests that verify the React code still calls the backend render endpoint correctly and still displays the returned image.
- Backend API integration tests that hit the running FastAPI server over HTTP.

### Before running tests

Start the backend server first:

```powershell
backend\.venv\Scripts\python -m uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
```

The backend tests assume this default URL unless you override it:

- `ASHBY_BACKEND_URL` defaults to `http://127.0.0.1:8000`

### Run all tests

```powershell
npm test
```

### Run only the frontend proxy tests

```powershell
npm run test:frontend
```

### Run only the backend API tests

```powershell
npm run test:backend
```

### What the tests cover

- Backend render endpoint returns an image for a known sample config.
- Backend render endpoint exposes plotting warnings via response metadata when the config references missing-but-fallback axis columns.
- Backend spreadsheet upload returns detected columns and a cached `import_file_name`.
- Uploaded spreadsheet names can be fed back into the render endpoint successfully.
- Frontend `PlotPage` still posts to `/api/render-plot` with the active dataframe/frame selection.
- Frontend preview still turns the backend response blob into an `<img>`.
- Frontend preview still reads and displays plot messages returned by the backend.
- App state still stores the uploaded `import_file_name` and passes the active selection into `PlotPage`.

## Reference

- Config explanation: [backend/docs/config_explanation.jsonc](backend/docs/config_explanation.jsonc)
- Legacy plotting code: `backend/plot.py` plus `backend/plotting/*`


## Docker run guide

This project is designed to run as **two containers** (frontend + backend) on one Docker network so you actually test the same boundaries as production-style deployments.

### 1) Build images

```bash
docker build -t ashby-frontend -f Dockerfile.frontend .
docker build -t ashby-backend -f Dockerfile.backend .
```

### 2) Create an isolated network

```bash
docker network create ashby-net
```

### 3) Run backend container

```bash
docker run --rm -d \
  --name ashby-backend \
  --network ashby-net \
  -p 8000:8000 \
  ashby-backend
```

### 4) Run frontend container

```bash
docker run --rm -d \
  --name ashby-frontend \
  --network ashby-net \
  -e VITE_BACKEND_URL=http://ashby-backend:8000 \
  -p 5173:5173 \
  ashby-frontend
```

### 5) Verify both containers

```bash
docker ps
docker logs ashby-backend --tail 50
docker logs ashby-frontend --tail 50
```

Then open `http://127.0.0.1:5173`.

> If the repository does not yet include `Dockerfile.frontend` and `Dockerfile.backend`, add them first or adapt commands to your existing Dockerfiles / compose file.

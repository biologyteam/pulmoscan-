from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import os
from contextlib import asynccontextmanager

import db
from routes import audio, sensors, results, auth, sessions, research, enose
from services import sensor_processing

@asynccontextmanager
async def lifespan(_):
    db.init_db()
    yield


app = FastAPI(title="E-Nose PulmoScan API", description="AI-based asthma detection through breath analysis. Research prototype, not a diagnostic tool.", lifespan=lifespan)
# The website is served by this same server, so no CORS is needed. To develop the frontend from another
# origin, set PULMOSCAN_ORIGINS="http://localhost:5500,http://127.0.0.1:5500". Logins use cookies, so "*" is not allowed.
_origins = [o.strip() for o in os.environ.get("PULMOSCAN_ORIGINS", "").split(",") if o.strip()]
if _origins:
    app.add_middleware(CORSMiddleware, allow_origins=_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.exception_handler(RequestValidationError)
async def _validation(request: Request, exc: RequestValidationError):
    # A malformed post from the device (e.g. a NaN from a failed sensor) must show up as an "Error" connection state.
    if request.url.path == "/api/sensors/reading":
        sensor_processing.record_error("the device sent a malformed reading")
    return await request_validation_exception_handler(request, exc)


app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])
app.include_router(audio.router, prefix="/api/audio", tags=["audio"])
app.include_router(sensors.router, prefix="/api/sensors", tags=["sensors"])
app.include_router(results.router, prefix="/api/results", tags=["results"])
app.include_router(research.router, prefix="/api/research", tags=["research"])
app.include_router(enose.router, prefix="/api/enose", tags=["electronic nose"])


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve the website from the same server: open http://localhost:8000
app.mount("/", StaticFiles(directory=Path(__file__).parent.parent / "frontend", html=True), name="frontend")

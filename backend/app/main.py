import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .config import settings
from .db import Base, SessionLocal, engine
from .routers import auth, learn, live, parent, student, teacher
from .seed import seed_if_empty
from .services.translation import capabilities

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    if settings.DEMO_MODE:
        with SessionLocal() as db:
            if seed_if_empty(db):
                logging.getLogger("seed").info("Demo data created. Logins: teacher / parent / sona  (password: demo123)")
    yield


app = FastAPI(title="Shiksha Vani API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"], allow_credentials=True)

for r in (auth.router, learn.router, student.router, teacher.router, parent.router, live.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"ok": True, "capabilities": capabilities(), "demo": settings.DEMO_MODE}


# Serve the built React app from the same origin if it exists (single-container deploys).
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.exists():

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith(("api/", "ws/")):
            raise HTTPException(404)
        f = (DIST / path).resolve()
        if path and f.is_file() and DIST in f.parents:
            return FileResponse(f)
        return FileResponse(DIST / "index.html")

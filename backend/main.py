from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.connection import engine
from routes.ats import router as ats_router
from routes.auth import router as auth_router
from routes.dashboard import analyses_router, router as dashboard_router
from routes.resume import router as resume_router
from routes.resume_builder import router as resume_builder_router
from routes.saved_resumes import router as saved_resumes_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(title="AI Career Coach API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resume_router, prefix="/api")
app.include_router(ats_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(analyses_router, prefix="/api")
app.include_router(resume_builder_router, prefix="/api")
app.include_router(saved_resumes_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}

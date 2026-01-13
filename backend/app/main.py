"""
FastAPI Main Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import projects, articles, documents, erp
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Webbasiertes Stücklisten-ERP System"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In Production: spezifische Origins angeben
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(projects.router, prefix=settings.API_V1_STR, tags=["projects"])
app.include_router(articles.router, prefix=settings.API_V1_STR, tags=["articles"])
app.include_router(documents.router, prefix=settings.API_V1_STR, tags=["documents"])
app.include_router(erp.router, prefix=settings.API_V1_STR, tags=["erp"])


@app.get("/")
async def root():
    return {"message": "Stücklisten-ERP System API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}

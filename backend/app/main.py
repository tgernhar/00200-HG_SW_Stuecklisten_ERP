"""
FastAPI Main Application
"""
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.api.routes import projects, articles, documents, erp, hugwawi, boms, import_jobs, auth, orders_overview, hierarchy_remarks, pps
from app.core.config import settings
import traceback

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Webbasiertes Stücklisten-ERP System"
)

# CORS Middleware - MUSS vor Exception Handlers sein
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In Production: spezifische Origins angeben
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception Handler für alle Exceptions - stellt sicher, dass CORS-Header gesendet werden
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler that ensures CORS headers are sent even on errors"""
    import logging
    logging.error(f"Unhandled exception: {exc}", exc_info=True)
    print(f"ERROR: Global exception handler: {exc}", flush=True)
    import traceback
    traceback.print_exc()
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": str(exc),
            "type": type(exc).__name__
        },
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )



# Include Routers
app.include_router(auth.router, prefix=settings.API_V1_STR, tags=["auth"])
app.include_router(projects.router, prefix=settings.API_V1_STR, tags=["projects"])
app.include_router(articles.router, prefix=settings.API_V1_STR, tags=["articles"])
app.include_router(documents.router, prefix=settings.API_V1_STR, tags=["documents"])
app.include_router(erp.router, prefix=settings.API_V1_STR, tags=["erp"])
app.include_router(hugwawi.router, prefix=settings.API_V1_STR, tags=["hugwawi"])
app.include_router(boms.router, prefix=settings.API_V1_STR, tags=["boms"])
app.include_router(import_jobs.router, prefix=settings.API_V1_STR, tags=["import-jobs"])
app.include_router(orders_overview.router, prefix=settings.API_V1_STR, tags=["orders-overview"])
app.include_router(hierarchy_remarks.router, prefix=settings.API_V1_STR, tags=["hierarchy-remarks"])
app.include_router(pps.router, prefix=settings.API_V1_STR, tags=["pps"])


@app.get("/")
async def root():
    return {"message": "Stücklisten-ERP System API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}

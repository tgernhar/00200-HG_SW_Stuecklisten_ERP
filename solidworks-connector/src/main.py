"""
SOLIDWORKS Connector - FastAPI Server
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from SolidWorksConnector import SolidWorksConnector

app = FastAPI(title="SOLIDWORKS Connector API", version="1.0.0")

# Global connector instance
connector = SolidWorksConnector()


class AssemblyRequest(BaseModel):
    assembly_filepath: str


class Create3DDocumentsRequest(BaseModel):
    filepath: str
    step: bool = False
    x_t: bool = False
    stl: bool = False


@app.get("/")
async def root():
    return {"message": "SOLIDWORKS Connector API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/api/solidworks/get-all-parts-from-assembly")
async def get_all_parts_from_assembly(request: AssemblyRequest):
    """
    Liest alle Teile und Properties aus Assembly
    """
    try:
        results = connector.get_all_parts_and_properties_from_assembly(
            request.assembly_filepath
        )
        return {
            "success": True,
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/solidworks/create-3d-documents")
async def create_3d_documents(request: Create3DDocumentsRequest):
    """
    Erstellt 3D-Dokumente (STEP, X_T, STL)
    """
    try:
        success = connector.create_3d_documents(
            request.filepath,
            step=request.step,
            x_t=request.x_t,
            stl=request.stl
        )
        
        if success:
            created_files = []
            base_path = request.filepath[:-7]  # Entferne Endung
            if request.step:
                created_files.append(f"{base_path}.stp")
            if request.x_t:
                created_files.append(f"{base_path}.x_t")
            if request.stl:
                created_files.append(f"{base_path}.stl")
            
            return {
                "success": True,
                "created_files": created_files
            }
        else:
            raise HTTPException(status_code=500, detail="Fehler beim Erstellen der 3D-Dokumente")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

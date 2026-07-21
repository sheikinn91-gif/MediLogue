import os
import json
import base64
from fastapi import FastAPI, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional

# Import our custom database and AI client engines
from database import save_clinical_intake
from OpenAI_client import generate_clinical_summary

# Initialize FastAPI application
app = FastAPI(
    title="MediLogue AI Backend Engine",
    description="Advanced AI-driven healthcare translation API for rural patients.",
    version="1.0.2"
)

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# Vision Analysis Simulation
# ==========================================

def call_vision_model(base64_image: str, prompt: str):
    """
    Simulated function to call the Vision API.
    Replace this logic with DashScope MultiModalConversation 
    when ready for production multi-modal deployment.
    """
    class MockResponse:
        output_text = "Patient is showing signs of severe respiratory distress (e.g., clutching chest, rapid breathing)."
    
    return MockResponse()

# ==========================================
# Pydantic Data Models (Updated with Indicators)
# ==========================================

class PatientIntakeRequest(BaseModel):
    patient_input: str = Field(..., examples=["Doktor, bapa saya mengadu ampus..."])
    vitals: Dict[str, str] = Field(default_factory=dict)
    extracted_terms: List[str] = Field(default_factory=list)
    
    # New indicators matched with the frontend specifications
    age: int = Field(default=25, ge=0, le=120, description="Patient age in years")
    gender: str = Field(default="Male", description="Biological sex/gender profile")
    medical_history: str = Field(default="", description="Pre-existing clinical background or allergies")
    language_mode: str = Field(default="Sabah (Sabahan Malay)", description="Active regional dialect or intake pipeline")

class IntakeResponse(BaseModel):
    status: str
    clinical_summary: str
    database_record_id: Optional[str] = None

# ==========================================
# API Endpoints
# ==========================================

@app.get("/", tags=["Root"])
def read_root():
    return {"status": "online", "project": "MediLogue"}

@app.post("/api/v1/intake", response_model=IntakeResponse, status_code=status.HTTP_201_CREATED)
async def process_patient_intake(payload: PatientIntakeRequest):
    if not payload.patient_input.strip():
        raise HTTPException(status_code=400, detail="Patient complaint cannot be empty.")

    # Forwarding all 4 new clinical parameters directly into the updated engine
    ai_summary = generate_clinical_summary(
        patient_complaint=payload.patient_input, 
        extracted_terms=payload.extracted_terms,
        age=payload.age,
        gender=payload.gender,
        medical_history=payload.medical_history,
        language_mode=payload.language_mode,
        vitals=payload.vitals  # <-- Injecting the new vitals parameter here
    )
    
    if "System Error" in ai_summary:
        raise HTTPException(status_code=500, detail=ai_summary)

    # Saving intake payload down to local database
    db_response_raw = save_clinical_intake(
        patient_input=payload.patient_input,
        vitals=payload.vitals,
        ai_summary=ai_summary
    )
    
    db_response = json.loads(db_response_raw)
    
    return IntakeResponse(
        status="success",
        clinical_summary=ai_summary,
        database_record_id=db_response.get("inserted_id")
    )

@app.post("/process-sign-language")
async def process_sign_language(file: UploadFile = File(...)):
    """
    Receives sign language frame image from client camera and passes it to the Vision Engine.
    """
    try:
        contents = await file.read()
        encoded_image = base64.b64encode(contents).decode("utf-8")
        
        # Process using Vision Engine
        response = call_vision_model(encoded_image, prompt="Translate this sign language into clinical symptoms.")
        
        return {"translated_text": response.output_text}
    except Exception as e:
        print(f"RALAT KRITIKAL: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Vision analysis error: {str(e)}")
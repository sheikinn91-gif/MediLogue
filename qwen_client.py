import os
import json
from openai import OpenAI
from dotenv import load_dotenv
# Import the retrieval function directly from your database module
from database import get_dialect_meaning

# Load environmental variables from .env file
load_dotenv()

# Initialize the OpenAI-compatible client tailored for Alibaba Cloud Qwen (Singapore region)
client = OpenAI(
    api_key=os.getenv("QWEN_API_KEY"),
    base_url=os.getenv("https://ws-jpe3qd2fcs667bc9.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1")
)

def generate_clinical_summary(
    patient_complaint: str, 
    extracted_terms: list, 
    age: int, 
    gender: str, 
    medical_history: str, 
    language_mode: str,
    vitals: dict  # <--- SUNTIKAN PARAMETER BARU DI SINI
) -> str:
    """
    Combines raw patient complaints, dynamic biometric vitals telemetry, demographic risk indicators,
    clinical background, and local database glossary mappings to generate an absolute clinical triage matrix.
    """
    
    # 1. Fetch meanings from database for each extracted dialect term
    glossary_context = []
    for term in extracted_terms:
        raw_meaning = get_dialect_meaning(term)
        try:
            parsed_meaning = json.loads(raw_meaning)
            # Only append if the term actually exists in our database glossary
            if "not found" not in parsed_meaning.get("meaning", "").lower():
                glossary_context.append(f"- {parsed_meaning['term']}: {parsed_meaning['meaning']}")
        except Exception:
            continue
            
    # Format the dynamic glossary database string for the AI prompt
    glossary_string = "\n".join(glossary_context) if glossary_context else "No specific local dialect terms found in local glossary database."

    # Parse objective biometric telemetry values out safely
    bp = vitals.get("systolic_diastolic", "N/A")
    oxygen = vitals.get("oxygen_saturation", "N/A")
    temperature = vitals.get("temperature", "N/A")

    try:
        chat_client = getattr(client, "chat")
        response = getattr(chat_client, "completions").create(
            model="qwen3.7-max",
            messages=[
                {
                    "role": "system", 
                    "content": (
                        "You are an expert medical translation agent and high-acuity triage optimization assistant for MediLogue.\n"
                        "Your job is to convert raw regional complaints into highly professional, structured clinical notes.\n\n"
                        "CRITICAL CLINICAL CONTEXT & PATIENT TELEMETRY TO WEIGHT:\n"
                        f"- Patient Age: {age} years old (Evaluate age-specific triage emergency risks & specific pediatric/geriatric vital thresholds)\n"
                        f"- Gender Profile: {gender}\n"
                        f"- Known History & Allergies: {medical_history if medical_history else 'None Reported'}\n"
                        f"- Selected Communication Pipeline: {language_mode}\n"
                        "OBJECTIVE BIOMETRIC VITALS SYNC:\n"
                        f"  * Blood Pressure: {bp}\n"
                        f"  * Oxygen Saturation (SpO2): {oxygen} (CRITICAL: Immediately trigger HIGH severity if SpO2 < 95% regardless of text brevity)\n"
                        f"  * Core Body Temperature: {temperature} (CRITICAL: Immediately evaluate hyperpyrexia risk if Temp >= 38.5°C)\n\n"
                        "AI Reasoning Guideline: Cross-reference the raw text complaint against the age, active biometric vitals metrics, and verified glossary. You MUST explicitly state the biometric values in the analysis report and adjust triage severity level to HIGH/EMERGENT if objective metrics show clinical distress."
                        # Tambah ayat ini dalam System Prompt main.py anda:
                        "STRICT TRIAGE RULE: If objective biometric vitals are strictly NORMAL/STABLE (e.g., SpO2 >= 95%, Temp < 38.5°C, BP > 90/60) and the complaint is severe localized pain (like renal colic/abdominal cramp), you MUST classify the Severity Level as MEDIUM/YELLOW. Do not over-triage to HIGH unless there is active biometric failure or explicit signs of shock."
                        "You MUST format your response using rich Markdown. "
                        "Use Markdown headers (##) for main sections. "
                        "CRITICAL: You MUST use a Markdown table (|---|---|) for the 'Clinical Translation/Interpretation' section to map raw phrases to their clinical meanings."
                    )
                },
                {
                    "role": "user", 
                    "content": (
                        f"Verified Local Glossary Context:\n{glossary_string}\n\n"
                        f"Raw Patient Complaint: \"{patient_complaint}\"\n\n"
                        "Please provide a professional English clinical summary including:\n"
                        "1. Chief Complaint (CC)\n"
                        "2. Clinical Translation/Interpretation (Mapping local idioms to official medical terms)\n"
                        "3. Patient Demographics & Biometric Risk Summary (Explicitly review age and current vitals status)\n"
                        "4. Potential Severity Level (Low/Medium/High based on complaint + vitals metrics combined)"
                    )
                }
            ],
            temperature=0.1, # Diturunkan sedikit untuk hasil penulisan yang lebih rigid/fakta
            max_tokens=1000
        )
        
        ai_content = response.choices[0].message.content
        return ai_content if ai_content is not None else "Error: AI generated an empty response."

    except Exception as e:
        return f"System Error: Unable to generate clinical summary. Details: {str(e)}"

# Direct test execution block
if __name__ == "__main__":
    sample_text = "Doktor, bapa saya mengadu ampus dari malam tadi dan dada dia rasa ketat."
    detected_dialects = ["ampus"]
    sample_vitals = {"systolic_diastolic": "140/90", "oxygen_saturation": "91%", "temperature": "38.5°C"}
    
    print("--- Testing Integrated MediLogue Qwen Engine with Patient Indicators & Vitals ---")
    output = generate_clinical_summary(
        patient_complaint=sample_text, 
        extracted_terms=detected_dialects,
        age=68,
        gender="Male",
        medical_history="Hypertension, Chronic Kidney Disease",
        language_mode="Sabah (Sabahan Malay)",
        vitals=sample_vitals
    )
    print(output)
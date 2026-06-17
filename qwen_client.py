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
    base_url=os.getenv("QWEN_BASE_URL")
)

def generate_clinical_summary(patient_complaint: str, extracted_terms: list) -> str:
    """
    Combines raw patient complaints with local database glossary mappings 
    to generate a highly accurate clinical summary using qwen3.7-max.
    
    Args:
        patient_complaint (str): The raw complaint text from the patient.
        extracted_terms (list): List of detected dialect terms to look up in MongoDB.
        
    Returns:
        str: Professionally translated clinical summary or error message.
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

    # Sila kemas kini bahagian akhir blok try di dalam fail qwen_client.py:

    try:
        response = client.chat.completions.create(
            model="qwen3.7-max",
            messages=[
                {
                    "role": "system", 
                    "content": (
                        "You are an expert medical translation agent for MediLogue. "
                        "Your job is to convert raw patient complaints into structured clinical notes. "
                        "You are provided with a verified local database glossary to assist your clinical reasoning. "
                        "Always prioritize the definitions found in the verified glossary."
                    )
                },
                {
                    "role": "user", 
                    "content": (
                        f"Verified Local Glossary Context:\n{glossary_string}\n\n"
                        f"Raw Patient Complaint: \"{patient_complaint}\"\n\n"
                        "Please provide a professional English clinical summary including:\n"
                        "1. Chief Complaint (CC)\n"
                        "2. Clinical Translation/Interpretation\n"
                        "3. Potential Severity Level (Low/Medium/High)"
                    )
                }
            ],
            temperature=0.2,
            max_tokens=1000
        )
        
        # 🔥 DI SINI PENYELESAIANNYA: Tambah `or ""` di hujung untuk menghalang pulangan nilai 'None'
        ai_content = response.choices[0].message.content
        return ai_content if ai_content is not None else "Error: AI generated an empty response."

    except Exception as e:
        return f"System Error: Unable to generate clinical summary. Details: {str(e)}"

# Direct test execution block
if __name__ == "__main__":
    sample_text = "Doktor, bapa saya mengadu ampus dari malam tadi dan dada dia rasa ketat."
    detected_dialects = ["ampus"]
    
    print("--- Testing Integrated MediLogue Qwen Engine ---")
    output = generate_clinical_summary(sample_text, detected_dialects)
    print(output)
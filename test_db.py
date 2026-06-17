import json
from database import get_dialect_meaning

def test_database_retrieval():
    print("--- Executing Database Glossary Retrieval Test ---")
    
    # Define the term we want to test (seeded from our glossary)
    test_term = "pusing"
    
    # Fetch the clinical meaning string (returns a JSON string from database.py)
    raw_result = get_dialect_meaning(test_term)
    
    try:
        # Parse the JSON string into a Python dictionary for cleaner formatting
        result_data = json.loads(raw_result)
        
        # Check if the database successfully mapped the term or returned a 'not found' meaning
        if "error" not in result_data and "not found" not in result_data.get("meaning", "").lower():
            print(f"✅ Success! Connection verified and term retrieved.")
            print(f"Term   : {result_data.get('term')}")
            print(f"Meaning: {result_data.get('meaning')}")
        else:
            print(f"❌ Term Missing: The term '{test_term}' was processed but not found in the glossary database.")
            print(f"Database Response: {result_data.get('meaning')}")
            
    except json.JSONDecodeError:
        # Fallback print if the response format changes or an unhandled string is returned
        print(f"⚠️ Warning: Retrieved data is not in a valid JSON format.")
        print(f"Raw Output: {raw_result}")

if __name__ == "__main__":
    test_database_retrieval()
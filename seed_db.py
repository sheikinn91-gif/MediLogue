import json
# Sila pastikan nama import collection ini sepadan dengan fail database.py anda
from database import dialect_collection 

# Medical glossary mapping local Sabah dialects to formal clinical descriptions
# 🔥 KUNCI DIUBAH DARI "dialect" KEPADA "term" AGAR SEPADAN DENGAN RAG ENGINE
dialect_data = [
    {
        "term": "pusing", 
        "meaning": "Dizziness, lightheadedness, or a sensation of spinning (vertigo)."
    },
    {
        "term": "nda", 
        "meaning": "Negation, meaning 'no', 'not', or 'cannot'."
    },
    {
        "term": "batuk-batuk", 
        "meaning": "Persistent or recurrent coughing."
    },
    {
        "term": "ampus",
        "meaning": "Asthma, shortness of breath, acute respiratory distress, or bronchospasm (dyspnea)."
    },
    {
        "term": "ngilu",
        "meaning": "Hypersensitivity or sharp, radiating pain, commonly associated with dental discomfort or joint nerve pain."
    },
    {
        "term": "pedi tekook",
        "meaning": "Sore throat, acute pharyngitis, or painful swallowing (odynophagia)."
    }
]

def seed_database():
    print("--- Starting Database Seeding Process ---")
    
    try:
        # 🔥 AKTIFKAN INI untuk buang data lama yang menggunakan kunci "dialect"
        print("Clearing old dialect glossary data...")
        dialect_collection.delete_many({})
        
        # Insert the dialect glossary dataset
        result = dialect_collection.insert_many(dialect_data)
        
        print("✅ Database seeding completed successfully!")
        print(f"Total documents inserted: {len(result.inserted_ids)}")
        print(f"Current total terms in database: {dialect_collection.count_documents({})}")
        
    except Exception as e:
        print(f"❌ Database seeding failed. Error details: {str(e)}")

if __name__ == "__main__":
    seed_database()
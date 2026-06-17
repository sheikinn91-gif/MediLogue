import streamlit as st

# 1. Konfigurasi Halaman & Gaya Visual
st.set_page_config(page_title="MediLogue AI", page_icon="🏥", layout="centered")

# CSS Tambahan untuk mencantikkan UI
st.markdown("""
    <style>
    .main {
        background-color: #f5f7f9;
    }
    .stButton>button {
        width: 100%;
        border-radius: 10px;
        height: 3em;
        background-color: #007bff;
        color: white;
    }
    </style>
    """, unsafe_allow_html=True)

# 2. Tajuk & Visi Projek
st.title("🏥 MediLogue")
st.subheader("Bridging Dialects to Medical Clarity")
st.markdown("Aplikasi AI untuk merapatkan jurang komunikasi perubatan di kawasan pedalaman.")

# 3. Fungsi Simulasi Pemetaan (Placeholder untuk Gemma 4)
def process_dialect(text):
    # Logik ini akan digantikan dengan panggilan model Gemma 4 nanti
    # Buat masa ini, ia melakukan padanan kata kunci dari fail .txt anda
    keywords = {
        "luyuh": "Lethargic / Generalized Weakness",
        "ngalih": "Severe Fatigue / Exhaustion",
        "pusing": "Vertigo / Dizziness",
        "bengkak": "Edema / Fluid Retention",
        "panas": "Hyperthermia / Fever",
        "muntah": "Nausea and Vomiting",
        "tegang": "Muscle Tension / Spasm"
    }
    
    found_symptoms = []
    input_clean = text.lower()
    
    for key, value in keywords.items():
        if key in input_clean:
            found_symptoms.append(value)
    
    if not found_symptoms:
        return "Analyzing context via Gemma 4 Knowledge Base..."
    return ", ".join(found_symptoms)

# 4. Bahagian Input Pengguna
st.write("---")
dialect_input = st.text_area(
    "Masukkan Simptom (Dialek Sabah / Bahasa Pasar):",
    placeholder="Contoh: 'Doktor, saya rasa ngalih betul ni badan, kaki pun bengkak...'",
    height=150
)

# 5. Butang Tindakan
col1, col2 = st.columns(2)

with col1:
    if st.button("Terjemah untuk Doktor 👨‍⚕️"):
        if dialect_input:
            with st.spinner('Menganalisis dialek...'):
                result = process_dialect(dialect_input)
                st.info(f"**Medical Terminology (English):**\n\n**{result}**")
        else:
            st.warning("Sila masukkan simptom.")

with col2:
    if st.button("Penjelasan untuk Pesakit 👤"):
        if dialect_input:
            st.success("**Bahasa Mudah (Nasihat):**\n\nSila berehat dan pastikan pengambilan air yang cukup sementara menunggu pemeriksaan doktor.")
        else:
            st.warning("Sila masukkan simptom.")

# 6. Footer Dokumentasi
st.write("---")
st.caption("MediLogue Project | Powered by Google Gemma 4 | Developed for Global Hackathon")
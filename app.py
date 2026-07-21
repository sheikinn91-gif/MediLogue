import streamlit as st
import requests
import os

# ==========================================
# PAGE INITIALIZATION & THEME MATRIX
# ==========================================
st.set_page_config(page_title="MediLogue Console V3.0", page_icon="🏥", layout="wide")

st.markdown("""
    <style>
    .main {
        background-color: #060b13;
        color: #a3b3c9;
        font-family: 'Inter', sans-serif;
    }
    h1, h2, h3 {
        color: #ffffff !important;
        font-weight: 600;
        letter-spacing: 0.5px;
    }
    .stTextInput>div>div>input, .stSelectbox>div>div>div, .stNumberInput>div>div>input, .stTextArea>div>div>textarea {
        background-color: #0a101d !important;
        color: #ffffff !important;
        border: 1px solid #1e293b !important;
        border-radius: 6px !important;
    }
    .execute-btn>div>button {
        width: 100%;
        border-radius: 8px;
        height: 3.5em;
        background-color: #ffffff !important;
        color: #060b13 !important;
        font-weight: 700 !important;
        border: none !important;
        font-size: 16px !important;
        transition: 0.3s ease;
    }
    .execute-btn>div>button:hover {
        background-color: #e2e8f0 !important;
        box-shadow: 0 0 15px rgba(255,255,255,0.3);
    }
    </style>
    """, unsafe_allow_html=True)

# TOP STATUS TELEMETRY BAR
col_top1, col_top2 = st.columns([2, 2])
with col_top1:
    st.markdown("<h2 style='margin:0; font-size:22px; color:#ffffff;'>🔵 MEDILOGUE <span style='font-size:12px; color:#64748b; vertical-align:middle; border:1px solid #1e293b; padding:2px 6px; border-radius:4px; margin-left:8px;'>CONSOLE V3.0</span></h2>", unsafe_allow_html=True)
with col_top2:
    st.markdown("<div style='text-align: right; font-size: 13px; margin-top: 5px;'><span style='color:#10b981; margin-right:15px;'>● Vocal Node: <b>Ready</b></span><span style='color:#64748b;'>● Vision Link: <b>Idle</b></span></div>", unsafe_allow_html=True)

st.markdown("<hr style='margin:15px 0; border-color:#1e293b;'>", unsafe_allow_html=True)

# MAIN DASHBOARD CONTAINER LAYOUT
col_left, col_right = st.columns([5, 5])

# ------------------------------------------
# LAJUR KIRI: INTAKE PIPELINE INTERFACE
# ------------------------------------------
with col_left:
    st.markdown("<p style='color:#6366f1; font-size:12px; font-weight:bold; margin-bottom:5px;'>01. INTAKE CHANNEL TARGET</p>", unsafe_allow_html=True)
    
    col_btn1, col_btn2 = st.columns(2)
    with col_btn1:
        st.button("🎤 Audio Input Stream", use_container_width=True)
    with col_btn2:
        st.button("📸 Vision Sign Stream", use_container_width=True)
        
    st.write("")
    
    st.markdown("""
        <div style='background-color:#0a101d; padding:40px 20px; border-radius:8px; border: 1px solid #1e293b; text-align:center;'>
            <p style='color:#64748b; font-size:13px; line-height:1.6; margin:0;'>Voice recognition system is ready. Click the trigger button to lock hardware capture.</p>
            <br>
            <div style='background-color:#0f172a; border: 1px solid #1e293b; padding:12px; border-radius:6px; display:inline-block; color:#a3b3c9; font-size:12px;'>🎙️ INITIALIZE AUDIO STREAM</div>
        </div>
        """, unsafe_allow_html=True)
        
    st.write("")
    st.markdown("<p style='color:#6366f1; font-size:12px; font-weight:bold; margin-bottom:5px;'>02. RAW PHONETIC DATA TEXTFIELD</p>", unsafe_allow_html=True)
    
    language_mode = st.selectbox(
        "Select Active Focus Dialect:",
        options=["Sabah (Sabahan Malay)", "Sarawak (Sarawakian Malay)", "Kelantan (Kelantanese)"]
    )
    
    dialect_input = st.text_area(
        "Text Intake Stream",
        placeholder="Transcription data or sign translation will map here in real-time. You can also type manually...",
        height=140,
        label_visibility="collapsed"
    )

# ------------------------------------------
# LAJUR KANAN: BIOMETRICS & THE MISSING CLINICAL INDICATORS
# ------------------------------------------
with col_right:
    st.markdown("<p style='color:#6366f1; font-size:12px; font-weight:bold; margin-bottom:5px;'>🩺 SYSTEMIC BIOMETRIC INDICATORS</p>", unsafe_allow_html=True)
    
    col_b1, col_b2, col_b3 = st.columns(3)
    with col_b1:
        st.markdown("<div style='background-color:#0a101d; padding:15px; border-radius:8px; border: 1px solid #1e293b; text-align:center;'><p style='color:#64748b; font-size:10px; font-weight:bold; margin:0;'>SYSTOLIC/DIASTOLIC</p><h3 style='color:#ffffff; font-size:22px; margin:5px 0 0 0;'>120/80</h3></div>", unsafe_allow_html=True)
    with col_b2:
        st.markdown("<div style='background-color:#0a101d; padding:15px; border-radius:8px; border: 1px solid #1e293b; text-align:center;'><p style='color:#64748b; font-size:10px; font-weight:bold; margin:0;'>OXYGEN SATURATION</p><h3 style='color:#38bdf8; font-size:22px; margin:5px 0 0 0;'>98%</h3></div>", unsafe_allow_html=True)
    with col_b3:
        st.markdown("<div style='background-color:#0a101d; padding:15px; border-radius:8px; border: 1px solid #1e293b; text-align:center;'><p style='color:#64748b; font-size:10px; font-weight:bold; margin:0;'>THERMAL METRIC</p><h3 style='color:#f43f5e; font-size:22px; margin:5px 0 0 0;'>37.0°C</h3></div>", unsafe_allow_html=True)
            
    st.write("")
    
    # =======================================================
    # DI SINI KOTAK INDIKATOR BARU DI PAKSA MASUK (MANDATORY INJECTION)
    # =======================================================
    st.markdown("<p style='color:#6366f1; font-size:12px; font-weight:bold; margin-bottom:5px;'>📋 PATIENT RISK FACTORS & CONTEXT</p>", unsafe_allow_html=True)
    
    col_sub1, col_sub2 = st.columns(2)
    with col_sub1:
        st.markdown("<span style='color:#64748b; font-size:11px; font-weight:bold;'>PATIENT AGE</span>", unsafe_allow_html=True)
        age = st.number_input("Age Val", label_visibility="collapsed", min_value=0, max_value=120, value=25, step=1)
        
    with col_sub2:
        st.markdown("<span style='color:#64748b; font-size:11px; font-weight:bold;'>BIOLOGICAL GENDER</span>", unsafe_allow_html=True)
        gender = st.selectbox("Gender Val", label_visibility="collapsed", options=["Male", "Female"], index=0)
        
    st.write("")
    st.markdown("<span style='color:#64748b; font-size:11px; font-weight:bold;'>MEDICAL HISTORY / KNOWN ALLERGIES</span>", unsafe_allow_html=True)
    medical_history = st.text_input("History Val", label_visibility="collapsed", placeholder="e.g., None / Asthma / Penicillin Allergy")

    st.write("")
    st.write("")

    # MASSIVE ACTION BUTTON
    st.markdown('<div class="execute-btn">', unsafe_allow_html=True)
    trigger_evaluation = st.button("EXECUTE AGENTIC TRIAGE EVALUATION 🚀")
    st.markdown('</div>', unsafe_allow_html=True)

    st.write("")

    # RESPONS OUTPUT FROM API PIPELINE
    if trigger_evaluation:
        if not dialect_input.strip():
            st.warning("Awaiting patient phonetic or sign input stream data before running analytics.")
        else:
            with st.spinner("Streaming data to OpenAI Engine..."):
                try:
                    backend_url = "http://127.0.0.1:8000/api/v1/intake"
                    payload = {
                        "patient_input": dialect_input,
                        "vitals": {"systolic_diastolic": "120/80", "oxygen_saturation": "98%", "temperature": "37.0°C"},
                        "extracted_terms": [],
                        "age": int(age),
                        "gender": gender,
                        "medical_history": medical_history,
                        "language_mode": language_mode
                    }
                    response = requests.post(backend_url, json=payload, timeout=15)
                    if response.status_code == 201:
                        st.markdown("### 🩺 Clinical Analysis Output")
                        st.info(response.json().get("clinical_summary"))
                except Exception as e:
                    st.error(f"Server Error: {str(e)}")
    else:
        st.markdown("""
            <div style='background-color:#0a101d; padding:40px 20px; border-radius:8px; border: 1px dashed #1e293b; text-align:center;'>
                <p style='color:#64748b; font-size:12px; margin:0;'>Awaiting patient data stream dispatch from the intake console...</p>
            </div>
            """, unsafe_allow_html=True)
import React, { useRef, useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as tf from "@tensorflow/tfjs";
import * as handpose from "@tensorflow-models/handpose";
// @ts-ignore
import * as fp from "fingerpose";

interface Vitals {
  systolic_diastolic: string;
  oxygen_saturation: string;
  temperature: string;
}

interface TriagePayload {
  patient_input: string;
  vitals: Vitals;
  extracted_terms: string[];
  age: number;
  gender: string;
  medical_history: string;
  language_mode: string;
}

export default function App() {
  // ==========================================
  // 1. REACT STATES FOR PATIENT DATA STREAM
  // ==========================================
  const [dialectInput, setDialectInput] = useState<string>("");
  const [languageMode, setLanguageMode] = useState<string>(
    "Sabah (Sabahan Malay)",
  );
  const cooldownTimer = useRef<number>(0);
  // Tambah ini di bawah useState yang sedia ada
  const [clinicalOutput, setClinicalOutput] = useState<any>(null);

  // Patient Profile States
  const [age, setAge] = useState<number>(25);
  const [gender, setGender] = useState<string>("Male");
  const [medicalHistory, setMedicalHistory] = useState<string>("");

  // Biometric Vitals States
  const [bp, setBp] = useState<string>("120/80");
  const [oxygen, setOxygen] = useState<number>(98);
  const [temperature, setTemperature] = useState<number>(37.0);

  // Pipeline Status & Output States
  const [loading, setLoading] = useState<boolean>(false);
  const [clinicalSummary, setClinicalSummary] = useState<string>("");
  const [recordId, setRecordId] = useState<string>("");
  const [errorLog, setErrorLog] = useState<string>("");

  // ==========================================
  // 2. DYNAMIC API SUBMISSION PIPELINE
  // ==========================================
  const handleExecuteTriage = async () => {
    if (!dialectInput.trim()) {
      alert(
        "Awaiting patient phonetic or sign input stream data before running analytics.",
      );
      return;
    }

    setLoading(true);
    setErrorLog("");
    setClinicalSummary("");

    const simulatedTerms: string[] = [];
    if (dialectInput.toLowerCase().includes("ampus"))
      simulatedTerms.push("ampus");
    if (dialectInput.toLowerCase().includes("ngalih"))
      simulatedTerms.push("ngalih");

    const payload: TriagePayload = {
      patient_input: dialectInput,
      vitals: {
        systolic_diastolic: bp,
        oxygen_saturation: `${oxygen}%`,
        temperature: `${temperature}°C`,
      },
      extracted_terms: simulatedTerms,
      age: Number(age),
      gender: gender,
      medical_history: medicalHistory,
      language_mode: languageMode,
    };

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/api/v1/intake",
        payload,
      );
      if (response.status === 201 || response.status === 200) {
        setClinicalSummary(response.data.clinical_summary);
        setRecordId(response.data.database_record_id || "N/A");
        setClinicalOutput(response.data); // Simpan hasil analisis klinikal
      } else {
        setErrorLog(
          `Backend Fault (${response.status}): ${JSON.stringify(response.data)}`,
        );
      }
    } catch (err: any) {
      setErrorLog(
        err.response?.data?.detail ||
          err.message ||
          "Failed to establish node connection.",
      );
    } finally {
      setLoading(false);
    }
  };

  // 1. Hook untuk menyimpan status dan data stream
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [mediaStream, setMediaStream] = React.useState<MediaStream | null>(
    null,
  );
  const signDetectionInterval = React.useRef<any>(null);
  const recognitionRef = React.useRef<any>(null);
  const [liveTranscript, setLiveTranscript] = React.useState(""); // <--- KITA TAMBAH INI
  const PainGesture = new fp.GestureDescription("Sakit");
  for (let finger of [
    fp.Finger.Index,
    fp.Finger.Middle,
    fp.Finger.Ring,
    fp.Finger.Pinky,
  ]) {
    PainGesture.addCurl(finger, fp.FingerCurl.FullCurl, 1.0);
    PainGesture.addCurl(finger, fp.FingerCurl.HalfCurl, 0.9);
  }

  // 2. Isyarat "TOLONG" (Bentuk: Tapak tangan terbuka luas / Kertas)
  const TolongGesture = new fp.GestureDescription("Tolong");
  for (let finger of [
    fp.Finger.Thumb,
    fp.Finger.Index,
    fp.Finger.Middle,
    fp.Finger.Ring,
    fp.Finger.Pinky,
  ]) {
    TolongGesture.addCurl(finger, fp.FingerCurl.NoCurl, 1.0);
  }

  // 3. "DIFFICULTY OF BREATHING" Signal (Shape: Index finger only raised / Number 1)
  const SesakGesture = new fp.GestureDescription("Sesak Nafas");
  SesakGesture.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl, 1.0);
  SesakGesture.addCurl(fp.Finger.Middle, fp.FingerCurl.FullCurl, 1.0);
  SesakGesture.addCurl(fp.Finger.Ring, fp.FingerCurl.FullCurl, 1.0);
  SesakGesture.addCurl(fp.Finger.Pinky, fp.FingerCurl.FullCurl, 1.0);
  // NEW ADDITION: Force the thumb to be folded so it doesn't get confused with the 'L'
  SesakGesture.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 10.0);
  SesakGesture.addCurl(fp.Finger.Thumb, fp.FingerCurl.FullCurl, 10.0);

  const SakitDadaGesture = new fp.GestureDescription("Saya Sakit Dada");
  SakitDadaGesture.addCurl(fp.Finger.Index, fp.FingerCurl.FullCurl, 1.0);
  SakitDadaGesture.addCurl(fp.Finger.Middle, fp.FingerCurl.FullCurl, 1.0);
  SakitDadaGesture.addCurl(fp.Finger.Ring, fp.FingerCurl.FullCurl, 1.0);
  SakitDadaGesture.addCurl(fp.Finger.Pinky, fp.FingerCurl.FullCurl, 1.0);
  SakitDadaGesture.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
  SakitDadaGesture.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 10.0);

  // 2. 'useEffect' - It will wait for the video box to appear, then flash the camera
  React.useEffect(() => {
    if (isStreaming && videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [isStreaming, mediaStream]);

  const startMultimodalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setMediaStream(stream);
      setIsStreaming(true);

      // 1. VISION FUNCTION (SIGN LANGUAGE)
      const runSignLanguageDetection = async (
        videoElement: HTMLVideoElement,
      ) => {
        const net = await handpose.load();
        cooldownTimer.current = 0;

        signDetectionInterval.current = setInterval(async () => {
          if (videoElement && videoElement.readyState === 4) {
            const hand = await net.estimateHands(videoElement);

            if (hand.length > 0) {
              const GE = new fp.GestureEstimator([
                PainGesture,
                TolongGesture,
                SesakGesture,
                SakitDadaGesture,
              ]);

              const estimated = GE.estimate(hand[0].landmarks, 7.5);

              if (estimated.gestures.length > 0) {
                // @ts-ignore - Tutup ralat TS untuk parameter p dan c
                const bestMatch = estimated.gestures.reduce((p, c) =>
                  p.score > c.score ? p : c,
                );

                // 1. ABSOLUTE REQUIREMENTS: AI score must be 8.0 and above only!
                if (bestMatch.score >= 8.0) {
                  // <-- Pastikan ia >= (Lebih besar atau sama dengan)

                  // 2. Dapatkan rekod masa detik ini
                  const masaSekarang = Date.now();

                  // 3. Hanya benarkan isyarat masuk selepas 2 saat (2000 milisaat) berehat
                  if (masaSekarang - cooldownTimer.current > 2000) {
                    setDialectInput(
                      (prevText: string) =>
                        prevText + " [" + bestMatch.name + "] ",
                    );

                    // 4. Reset masa supaya AI mula mengira 2 saat semula
                    cooldownTimer.current = masaSekarang;
                  }
                }
              }
            }
          }
        }, 800);
      };

      setTimeout(() => {
        if (videoRef.current) {
          runSignLanguageDetection(videoRef.current);
        }
      }, 1000);

      // 2. FUNGSI VOICE (SUARA)
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "ms-MY";

        recognition.onresult = (event: any) => {
          let currentTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setDialectInput(currentTranscript);
        };
        recognition.start();
      }
    } catch (err) {
      console.error(err);
    }
  };
  // ==========================================
  // 2. FUNGSI STOP (TUTUP KAMERA) - MESTI DI LUAR
  // ==========================================
  const stopMultimodalStream = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }
    if (signDetectionInterval.current) {
      clearInterval(signDetectionInterval.current);
      signDetectionInterval.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setMediaStream(null);
  };

  return (
    // LATAR BELAKANG UTAMA: Bertukar ke Putih/Kelabu Lembut (#f8fafc) & Teks Gelap (#334155)

    <div
      style={{
        backgroundColor: "#f8fafc",
        color: "#334155",
        minHeight: "100vh",
        fontFamily: "'Inter', sans-serif",
        padding: "20px",
      }}
    >
      <div>
        {/* GLOBAL HUD STATUS HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid #e2e8f0",
            paddingBottom: "15px",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
              color: "#0f172a",
              display: "flex",
              alignItems: "center",
            }}
          >
            🔵 MEDILOGUE{" "}
            <span
              style={{
                fontSize: "11px",
                color: "#64748b",
                border: "1px solid #cbd5e1",
                padding: "2px 6px",
                borderRadius: "4px",
                marginLeft: "8px",
                fontWeight: "bold",
                backgroundColor: "#f1f5f9",
              }}
            >
              CONSOLE V3.0
            </span>
          </h2>
          <div style={{ fontSize: "13px" }}>
            <span style={{ color: "#10b981", marginRight: "15px" }}>
              ● Vocal Node: <b>Ready</b>
            </span>
            <span style={{ color: "#64748b" }}>
              ● Vision Link: <b>Idle</b>
            </span>
          </div>
        </div>

        {/* ======================================================= */}
        {/* LAJUR KIRI: INTAKE CONTROLS & PHONETIC TEXTFIELD        */}
        {/* ======================================================= */}
        <div style={{ flex: 1, minWidth: "45%" }}>
          <p
            style={{
              color: "#4f46e5",
              fontSize: "12px",
              fontWeight: "bold",
              marginBottom: "8px",
              letterSpacing: "0.5px",
            }}
          >
            01. INTAKE CHANNEL TARGET
          </p>

          {/* KAD MULTIMODAL BAHARU DENGAN VIDEO PLAYER */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center text-center transition-all hover:shadow-md mb-5">
            {!isStreaming ? (
              // PAPARAN SEBELUM KAMERA DIHIDUPKAN
              <>
                <div className="bg-indigo-50 text-indigo-600 p-4 rounded-full mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
                    <circle cx="12" cy="13" r="3"></circle>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">
                  Multimodal AI Intake
                </h3>
                <p className="text-slate-500 text-sm mb-6 max-w-md">
                  System is ready. Click the button below to lock hardware
                  capture and initialize the unified camera and microphone
                  stream.
                </p>
                <button
                  onClick={startMultimodalStream}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-all shadow hover:shadow-lg active:scale-95"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  INITIALIZE STREAM
                </button>
              </>
            ) : (
              // PAPARAN SELEPAS KAMERA DIHIDUPKAN (LIVE VIDEO)
              <div className="w-full flex flex-col items-center">
                <div className="w-full max-w-2xl mx-auto aspect-video relative rounded-lg overflow-hidden border-4 border-indigo-100 shadow-inner bg-slate-900">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted /* Muted penting supaya suara anda tidak bergaung (echo) balik di speaker */
                    className="w-full h-full object-cover" /* <--- INI SAHAJA KELAS YANG BETUL UNTUK VIDEO */
                  />
                  {/* Lencana (Badge) Live Stream */}
                  <div className="absolute top-3 right-3 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded animate-pulse flex items-center gap-1 z-10">
                    <div className="w-2 h-2 bg-white rounded-full"></div> LIVE
                  </div>
                </div>

                {/* KOTAK UNTUK TEKS DAN BUTANG STOP */}
                <div className="flex flex-col items-center mt-4">
                  <p className="text-indigo-600 text-xs font-bold mb-3 tracking-wider uppercase">
                    ✓ Audio & Vision Stream Locked
                  </p>

                  {/* BUTANG STOP LIVE BAHARU */}
                  <button
                    onClick={stopMultimodalStream}
                    className="flex items-center gap-2 bg-red-100 hover:bg-red-600 text-red-600 hover:text-white font-bold py-2 px-5 rounded-full transition-all text-sm border border-red-200 hover:border-red-600 shadow-sm"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      stroke="none"
                    >
                      <rect
                        x="6"
                        y="6"
                        width="12"
                        height="12"
                        rx="2"
                        ry="2"
                      ></rect>
                    </svg>
                    STOP LIVE
                  </button>
                </div>
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: "45%" }}>
            <p
              style={{
                color: "#4f46e5",
                fontSize: "12px",
                fontWeight: "bold",
                marginBottom: "8px",
                letterSpacing: "0.5px",
              }}
            >
              02. RAW PHONETIC DATA TEXTFIELD
            </p>

            <select
              value={languageMode}
              onChange={(e) => setLanguageMode(e.target.value)}
              style={{
                width: "100%",
                backgroundColor: "#ffffff",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                padding: "12px",
                borderRadius: "8px",
                outline: "none",
                marginBottom: "10px",
                fontSize: "14px",
              }}
            >
              <option value="Sabah (Sabahan Malay)">
                Sabah (Sabahan Malay)
              </option>
              <option value="Sarawak (Sarawakian Malay)">
                Sarawak (Sarawakian Malay)
              </option>
              <option value="Kelantan (Kelantanese)">
                Kelantan (Kelantanese)
              </option>
              <option value="Sign Language Simulation (Gesture Descriptions)">
                Sign Language Simulation
              </option>
            </select>

            <textarea
              value={dialectInput}
              onChange={(e) => setDialectInput(e.target.value)}
              placeholder="Transcription data or sign translation will map here in real-time. You can also type manually..."
              style={{
                width: "100%",
                height: "80px",
                backgroundColor: "#ffffff",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                padding: "12px",
                borderRadius: "8px",
                outline: "none",
                resize: "none",
                fontSize: "14px",
                boxSizing: "border-box",
              }}
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setDialectInput(""); // Kosongkan transkripsi
                  setClinicalOutput(null); // Kosongkan hasil analisis klinikal
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-semibold text-sm transition"
              >
                Clear Transcription & Analysis
              </button>
            </div>
          </div>

          {/* ======================================================= */}
          {/* LAJUR KANAN: VITALS, DYNAMIC PROFILE CARDS & SUBMISSION */}
          {/* ======================================================= */}
          <div style={{ flex: 1, minWidth: "45%" }}>
            <p
              style={{
                color: "#4f46e5",
                fontSize: "12px",
                fontWeight: "bold",
                marginBottom: "8px",
                letterSpacing: "0.5px",
              }}
            >
              🩺 SYSTEMIC BIOMETRIC INDICATORS
            </p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <div
                style={{
                  flex: 1,
                  backgroundColor: "#ffffff",
                  padding: "8px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  textAlign: "center",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <span
                  style={{
                    color: "#64748b",
                    fontSize: "10px",
                    fontWeight: "bold",
                  }}
                >
                  BP (SYS/DIA)
                </span>
                <input
                  type="text"
                  value={bp}
                  onChange={(e) => setBp(e.target.value)}
                  style={{
                    width: "100%",
                    background: "none",
                    border: "none",
                    color: "#0f172a",
                    fontSize: "16px",
                    fontWeight: "bold",
                    textAlign: "center",
                    marginTop: "0px",
                    outline: "none",
                  }}
                />
              </div>

              <div
                style={{
                  flex: 1,
                  backgroundColor: "#ffffff",
                  padding: "8px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  textAlign: "center",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <span
                  style={{
                    color: "#64748b",
                    fontSize: "10px",
                    fontWeight: "bold",
                  }}
                >
                  OXYGEN LEVEL
                </span>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "baseline",
                    marginTop: "0px",
                  }}
                >
                  <input
                    type="number"
                    value={oxygen}
                    onChange={(e) => setOxygen(Number(e.target.value))}
                    style={{
                      width: "50px",
                      background: "none",
                      border: "none",
                      color: "#0284c7",
                      fontSize: "16px",
                      fontWeight: "bold",
                      textAlign: "center",
                      outline: "none",
                    }}
                  />
                  <span
                    style={{
                      color: "#0284c7",
                      fontWeight: "bold",
                      marginLeft: "2px",
                    }}
                  >
                    %
                  </span>
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  backgroundColor: "#ffffff",
                  padding: "8px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  textAlign: "center",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <span
                  style={{
                    color: "#64748b",
                    fontSize: "10px",
                    fontWeight: "bold",
                    display: "block",
                    marginBottom: "2px",
                  }}
                >
                  THERMAL METRIC
                </span>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "baseline",
                    marginTop: "0px",
                  }}
                >
                  <input
                    type="number"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    style={{
                      width: "60px",
                      background: "none",
                      border: "none",
                      color: "#dc2626",
                      fontSize: "16px",
                      fontWeight: "bold",
                      textAlign: "center",
                      outline: "none",
                    }}
                  />
                  <span
                    style={{
                      color: "#dc2626",
                      fontWeight: "bold",
                      marginLeft: "2px",
                    }}
                  >
                    °C
                  </span>
                </div>
              </div>
            </div>

            <p
              style={{
                color: "#4f46e5",
                fontSize: "12px",
                fontWeight: "bold",
                marginBottom: "8px",
                letterSpacing: "0.5px",
              }}
            >
              📋 PATIENT RISK FACTORS & CONTEXT
            </p>

            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    backgroundColor: "#f1f5f9",
                    padding: "4px 8px",
                    border: "1px solid #cbd5e1",
                    borderBottom: "none",
                    borderRadius: "8px 8px 0 0",
                  }}
                >
                  <span
                    style={{
                      color: "#475569",
                      fontSize: "10px",
                      fontWeight: "bold",
                    }}
                  >
                    PATIENT AGE
                  </span>
                </div>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  style={{
                    width: "100%",
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    border: "1px solid #cbd5e1",
                    padding: "8px",
                    borderRadius: "0 0 8px 8px",
                    outline: "none",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    backgroundColor: "#f1f5f9",
                    padding: "4px 8px",
                    border: "1px solid #cbd5e1",
                    borderBottom: "none",
                    borderRadius: "8px 8px 0 0",
                  }}
                >
                  <span
                    style={{
                      color: "#475569",
                      fontSize: "10px",
                      fontWeight: "bold",
                    }}
                  >
                    BIOLOGICAL GENDER
                  </span>
                </div>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  style={{
                    width: "100%",
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    border: "1px solid #cbd5e1",
                    padding: "8px",
                    borderRadius: "0 0 8px 8px",
                    outline: "none",
                    fontSize: "14px",
                    /*height: "43px",*/
                    boxSizing: "border-box",
                  }}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Pediatric / Unspecified">
                    Pediatric / Unspecified
                  </option>
                </select>
              </div>
            </div>

            <div style={{ width: "100%", marginBottom: "8px" }}>
              <div
                style={{
                  backgroundColor: "#f1f5f9",
                  padding: "4px 8px",
                  border: "1px solid #cbd5e1",
                  borderBottom: "none",
                  borderRadius: "8px 8px 0 0",
                }}
              >
                <span
                  style={{
                    color: "#475569",
                    fontSize: "10px",
                    fontWeight: "bold",
                  }}
                >
                  MEDICAL HISTORY / KNOWN ALLERGIES
                </span>
              </div>
              <input
                type="text"
                value={medicalHistory}
                onChange={(e) => setMedicalHistory(e.target.value)}
                placeholder="e.g., None / Asthma / Penicillin Allergy"
                style={{
                  width: "100%",
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  border: "1px solid #cbd5e1",
                  padding: "8px",
                  borderRadius: "0 0 8px 8px",
                  outline: "none",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* BUTTON EXECUTE - Tema Gelap Menyerlah di Latar Belakang Cerah */}
            <button
              onClick={handleExecuteTriage}
              disabled={loading}
              style={{
                width: "100%",
                height: "44px",
                borderRadius: "8px",
                backgroundColor: "#0f172a",
                color: "#ffffff",
                border: "none",
                fontWeight: "bold",
                fontSize: "14px",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "0.3s ease",
                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
              }}
            >
              {loading ? "PROCESSING ..." : "EXECUTE TRIAGE... 🚀"}
            </button>

            {/* RESPONSE OUTPUT CONTAINER */}
            <div style={{ marginTop: "12px" }}>
              {errorLog && (
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: "#fee2e2",
                    border: "1px solid #f87171",
                    borderRadius: "8px",
                    color: "#991b1b",
                    fontSize: "13px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  ❌ <b>Inference Interrupt:</b> {errorLog}
                </div>
              )}

              {clinicalSummary ? (
                <div
                  style={{
                    padding: "20px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    textAlign: "left",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
                  }}
                >
                  {/* DYNAMIC EMERGENCY ZONE UI/UX INDICATOR */}
                  {(() => {
                    const upperSummary = clinicalSummary.toUpperCase();

                    // 1. Cari titik mula tajuk "SEVERITY LEVEL" atau "4."
                    const severityIndex =
                      upperSummary.indexOf("SEVERITY LEVEL") !== -1
                        ? upperSummary.indexOf("SEVERITY LEVEL")
                        : upperSummary.indexOf("4.");

                    // 2. Potong dan ambil teks dari tajuk itu sampai habis
                    const scanArea =
                      severityIndex !== -1
                        ? upperSummary.substring(severityIndex)
                        : upperSummary;

                    // 3. Gunakan Regex \b (Word Boundary) untuk cari KATA KUNCI PERTAMA sahaja (kalis emoji)
                    const statusMatch = scanArea.match(
                      /\b(HIGH|EMERGENT|CRITICAL|MEDIUM|YELLOW|URGENT|PROMPT|LOW|GREEN)\b/,
                    );
                    const detectedStatus = statusMatch ? statusMatch[1] : "";

                    let zoneColor = "#10b981"; // Default: Green
                    let zoneText = "GREEN ZONE - ROUTINE / NON-URGENT";
                    let bgGlow = "#f0fdf4";

                    // Fail-Safe Vitals
                    if (oxygen < 95 || temperature >= 38.5) {
                      zoneColor = "#ef4444";
                      zoneText =
                        "RED ZONE - IMMEDIATE RESUSCITATION / CRITICAL";
                      bgGlow = "#fef2f2";
                    }
                    // Logik Pemetaan Berdasarkan Teks AI
                    else if (
                      ["HIGH", "EMERGENT", "CRITICAL"].includes(detectedStatus)
                    ) {
                      zoneColor = "#ef4444";
                      zoneText =
                        "RED ZONE - IMMEDIATE RESUSCITATION / CRITICAL";
                      bgGlow = "#fef2f2";
                    } else if (
                      ["MEDIUM", "YELLOW", "URGENT", "PROMPT"].includes(
                        detectedStatus,
                      )
                    ) {
                      zoneColor = "#f59e0b";
                      zoneText = "YELLOW ZONE - URGENT / PROMPT EVALUATION";
                      bgGlow = "#fffbeb";
                    }

                    return (
                      <div
                        style={{
                          backgroundColor: bgGlow,
                          border: `1px solid ${zoneColor}`,
                          padding: "12px 16px",
                          borderRadius: "6px",
                          marginBottom: "20px",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          boxShadow: `0 0 10px ${bgGlow}`,
                        }}
                      >
                        <span
                          style={{
                            height: "12px",
                            width: "12px",
                            backgroundColor: zoneColor,
                            borderRadius: "50%",
                            display: "inline-block",
                            boxShadow: `0 0 6px ${zoneColor}`,
                          }}
                        ></span>
                        <b
                          style={{
                            color: "#0f172a",
                            fontSize: "12px",
                            letterSpacing: "0.5px",
                          }}
                        >
                          {zoneText}
                        </b>
                      </div>
                    );
                  })()}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "10px",
                      borderBottom: "1px solid #f1f5f9",
                      paddingBottom: "8px",
                    }}
                  >
                    <span
                      style={{
                        color: "#4f46e5",
                        fontSize: "12px",
                        fontWeight: "bold",
                      }}
                    >
                      🩺 CLINICAL ANALYSIS OUTPUT
                    </span>
                    <span style={{ color: "#94a3b8", fontSize: "11px" }}>
                      Ledger ID: <code>{recordId}</code>
                    </span>
                  </div>
                  <div className="prose prose-sm prose-slate max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {clinicalSummary}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                !errorLog && (
                  <div
                    style={{
                      padding: "50px 20px",
                      backgroundColor: "#ffffff",
                      border: "1px dashed #cbd5e1",
                      borderRadius: "8px",
                      textAlign: "center",
                    }}
                  >
                    <span style={{ fontSize: "30px" }}>📊</span>
                    <p
                      style={{
                        color: "#94a3b8",
                        fontSize: "12px",
                        margin: "15px 0 0 0",
                      }}
                    >
                      Awaiting patient data stream dispatch from the intake
                      console...
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useRef, useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

interface ClinicalOutputType {
  clinical_summary: string;
  database_record_id: string;
  triage_level: string;
}

export default function App(): React.JSX.Element {
  // ==========================================
  // 1. REACT STATES FOR PATIENT DATA STREAM
  // ==========================================
  const [dialectInput, setDialectInput] = useState<string>("");
  const [languageMode, setLanguageMode] = useState<string>(
    "Sabah (Sabahan Malay)",
  );
  const cooldownTimer = useRef<number>(0);
  const [clinicalOutput, setClinicalOutput] =
    useState<ClinicalOutputType | null>(null);

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

  // Stream & Video States
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const signDetectionInterval = useRef<any>(null);
  const recognitionRef = useRef<any>(null);

  // ==========================================
  // 2. GESTURE DEFINITIONS
  // ==========================================
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

  const SesakGesture = new fp.GestureDescription("Sesak Nafas");
  SesakGesture.addCurl(fp.Finger.Index, fp.FingerCurl.NoCurl, 1.0);
  SesakGesture.addCurl(fp.Finger.Middle, fp.FingerCurl.FullCurl, 1.0);
  SesakGesture.addCurl(fp.Finger.Ring, fp.FingerCurl.FullCurl, 1.0);
  SesakGesture.addCurl(fp.Finger.Pinky, fp.FingerCurl.FullCurl, 1.0);
  SesakGesture.addCurl(fp.Finger.Thumb, fp.FingerCurl.HalfCurl, 10.0);
  SesakGesture.addCurl(fp.Finger.Thumb, fp.FingerCurl.FullCurl, 10.0);

  const SakitDadaGesture = new fp.GestureDescription("Saya Sakit Dada");
  SakitDadaGesture.addCurl(fp.Finger.Index, fp.FingerCurl.FullCurl, 1.0);
  SakitDadaGesture.addCurl(fp.Finger.Middle, fp.FingerCurl.FullCurl, 1.0);
  SakitDadaGesture.addCurl(fp.Finger.Ring, fp.FingerCurl.FullCurl, 1.0);
  SakitDadaGesture.addCurl(fp.Finger.Pinky, fp.FingerCurl.FullCurl, 1.0);
  SakitDadaGesture.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 1.0);
  SakitDadaGesture.addCurl(fp.Finger.Thumb, fp.FingerCurl.NoCurl, 10.0);

  useEffect(() => {
    if (isStreaming && videoRef.current && mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [isStreaming, mediaStream]);

  // ==========================================
  // 3. STREAM & DETECTION CONTROLS
  // ==========================================
  const startMultimodalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      setMediaStream(stream);
      setIsStreaming(true);

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
                // @ts-ignore
                const bestMatch = estimated.gestures.reduce((p, c) =>
                  p.score > c.score ? p : c,
                );

                if (bestMatch.score >= 8.0) {
                  const masaSekarang = Date.now();
                  if (masaSekarang - cooldownTimer.current > 2000) {
                    setDialectInput(
                      (prevText: string) =>
                        prevText + " [" + bestMatch.name + "] ",
                    );
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
        recognitionRef.current = recognition;
      }
    } catch (err) {
      console.error(err);
      alert("Could not initialize camera/microphone stream.");
    }
  };

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

  // ==========================================
  // 4. MOCK TRIAGE PIPELINE
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

    setTimeout(() => {
      const mockResponseData: ClinicalOutputType = {
        clinical_summary:
          "### Clinical Triage Summary\n1. **Chief Complaint:** Patient reports symptoms in Sabah Malay dialect.\n2. **Vitals Check:** Stable blood pressure (" +
          bp +
          "), oxygen saturation at " +
          oxygen +
          "%, and body temperature at " +
          temperature +
          "°C.\n3. **Assessment:** Semi-urgent category requiring standard clinical evaluation.\n4. **SEVERITY LEVEL: YELLOW / SEMI-URGENT**",
        database_record_id: "REC-2026-MED-9982",
        triage_level: "Yellow / Semi-Urgent",
      };

      setClinicalSummary(mockResponseData.clinical_summary);
      setRecordId(mockResponseData.database_record_id);
      setClinicalOutput(mockResponseData);
      setLoading(false);
    }, 1000);
  };

  // ==========================================
  // 5. MAIN UI RENDER
  // ==========================================
  return (
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
              ● Vision Link: <b>{isStreaming ? "Active" : "Idle"}</b>
            </span>
          </div>
        </div>

        {/* CONTAINER UTAMA DUA LAJUR */}
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          {/* LAJUR KIRI: INTAKE CONTROLS & PHONETIC TEXTFIELD */}
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

            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "24px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                marginBottom: "20px",
                textAlign: "center",
              }}
            >
              {!isStreaming ? (
                <>
                  <h3
                    style={{
                      fontSize: "18px",
                      fontWeight: "600",
                      marginBottom: "8px",
                      color: "#1e293b",
                    }}
                  >
                    Multimodal AI Intake
                  </h3>
                  <p
                    style={{
                      color: "#64748b",
                      fontSize: "14px",
                      marginBottom: "20px",
                    }}
                  >
                    System is ready. Click the button below to lock hardware
                    capture and initialize the unified camera and microphone
                    stream.
                  </p>
                  <button
                    onClick={startMultimodalStream}
                    style={{
                      backgroundColor: "#4f46e5",
                      color: "#ffffff",
                      padding: "12px 24px",
                      borderRadius: "8px",
                      border: "none",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    INITIALIZE STREAM
                  </button>
                </>
              ) : (
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      maxWidth: "2-xl",
                      background: "#0f172a",
                      borderRadius: "8px",
                      overflow: "hidden",
                      position: "relative",
                      aspectRatio: "16/9",
                    }}
                  >
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "12px",
                        right: "12px",
                        background: "#dc2626",
                        color: "#ffffff",
                        fontSize: "12px",
                        fontWeight: "bold",
                        padding: "4px 8px",
                        borderRadius: "4px",
                      }}
                    >
                      LIVE
                    </div>
                  </div>
                  <button
                    onClick={stopMultimodalStream}
                    style={{
                      marginTop: "12px",
                      backgroundColor: "#fee2e2",
                      color: "#dc2626",
                      border: "1px solid #f87171",
                      padding: "8px 16px",
                      borderRadius: "20px",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    STOP LIVE
                  </button>
                </div>
              )}
            </div>

            <div>
              <p
                style={{
                  color: "#4f46e5",
                  fontSize: "12px",
                  fontWeight: "bold",
                  marginBottom: "8px",
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
                <option value="English">English</option>
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
              <button
                onClick={() => {
                  setDialectInput("");
                  setClinicalOutput(null);
                  setClinicalSummary("");
                }}
                style={{
                  width: "100%",
                  marginTop: "10px",
                  padding: "8px",
                  backgroundColor: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  color: "#475569",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Clear Transcription & Analysis
              </button>
            </div>
          </div>

          {/* LAJUR KANAN: VITALS & SUBMISSION */}
          <div style={{ flex: 1, minWidth: "45%" }}>
            <p
              style={{
                color: "#4f46e5",
                fontSize: "12px",
                fontWeight: "bold",
                marginBottom: "8px",
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
                  <span style={{ color: "#0284c7", fontWeight: "bold" }}>
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
                }}
              >
                <span
                  style={{
                    color: "#64748b",
                    fontSize: "10px",
                    fontWeight: "bold",
                  }}
                >
                  THERMAL METRIC
                </span>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "baseline",
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
                  <span style={{ color: "#dc2626", fontWeight: "bold" }}>
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
                    boxSizing: "border-box",
                  }}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            <div style={{ width: "100%", marginBottom: "12px" }}>
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
                  MEDICAL HISTORY
                </span>
              </div>
              <input
                type="text"
                value={medicalHistory}
                onChange={(e) => setMedicalHistory(e.target.value)}
                placeholder="e.g., None / Asthma"
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
                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
              }}
            >
              {loading ? "PROCESSING ..." : "EXECUTE TRIAGE... 🚀"}
            </button>

            {/* RESPONSE OUTPUT */}
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
                  }}
                >
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
                  <div>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {clinicalSummary}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : (
                !errorLog && (
                  <div
                    style={{
                      padding: "30px 20px",
                      backgroundColor: "#ffffff",
                      border: "1px dashed #cbd5e1",
                      borderRadius: "8px",
                      textAlign: "center",
                    }}
                  >
                    <span style={{ fontSize: "24px" }}>📊</span>
                    <p
                      style={{
                        color: "#94a3b8",
                        fontSize: "12px",
                        margin: "10px 0 0 0",
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

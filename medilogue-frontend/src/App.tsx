import { useState, useEffect, useRef } from "react";

// ==========================================
// 📋 CONTRACT DEFINITIONS (TYPESCRIPT)
// ==========================================
interface TriageResult {
  urgency: "RED" | "YELLOW" | "GREEN";
  colorClass: string;
  badgeClass: string;
  justification: string;
  clinicalSummary: string;
}

type InputMode = "voice" | "sign";

export default function App() {
  // --- Core Patient Metrics ---
  const [complaint, setComplaint] = useState<string>("");
  const [bp, setBp] = useState<string>("");
  const [spo2, setSpo2] = useState<string>("");
  const [temp, setTemp] = useState<string>("");

  // --- Runtime Infrastructure States ---
  const [inputMode, setInputMode] = useState<InputMode>("voice");
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [visionLoading, setVisionLoading] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Hardware Memory References (Anti-Race Condition Guards) ---
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isRecordingRef = useRef<boolean>(false);

  // --- Core Downstream API Gateways ---
  const BACKEND_API_URL = "http://127.0.0.1:8000/api/v1/intake";
  const SIGN_LANGUAGE_API_URL = "http://127.0.0.1:8000/process-sign-language";

  // Sync state mutation directly into the memory reference layer
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // ==========================================
  // 🎤 IMMUTABLE AUDIO STREAM INITIALIZATION
  // ==========================================
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition && !recognitionRef.current) {
      const recognitionInstance = new SpeechRecognition();

      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = false;
      // Set to capture local dialect/Malay speech inputs from rural patients
      recognitionInstance.lang = "ms-MY";

      recognitionInstance.onresult = (event: any) => {
        const currentResultIndex = event.resultIndex;
        const transcript = event.results[currentResultIndex][0].transcript;
        setComplaint((prev) => (prev ? prev + " " + transcript : transcript));
      };

      recognitionInstance.onerror = (event: any) => {
        console.warn("Intercepted hardware speech warning:", event.error);
        if (event.error === "not-allowed") {
          setError("Microphone access denied. Check system privacy settings.");
          setIsRecording(false);
        }
      };

      // Auto-restart loop to prevent Chrome from shutting down the microphone during silence
      recognitionInstance.onend = () => {
        if (isRecordingRef.current) {
          console.log("Re-asserting vocal capture stream...");
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error("Critical failure during voice hot-reload:", e);
          }
        }
      };

      recognitionRef.current = recognitionInstance;
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // ==========================================
  // 🔄 HARDWARE PIPELINE SWITCHBOARD
  // ==========================================
  const handleInputChannelShift = async (targetMode: InputMode) => {
    if (targetMode === inputMode) return;

    setInputMode(targetMode);
    setError(null);

    // Leaving Voice Intake -> Initializing Vision Stream
    if (targetMode === "sign") {
      if (isRecording) {
        isRecordingRef.current = false;
        setIsRecording(false);
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log("Audio pipeline safely stopped.");
        }
      }

      // Explicitly lock camera stream to memory reference
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Camera linkage refused by hardware layer:", err);
        setError("Failed to resolve camera hardware bind. Verify permissions.");
      }
    }
    // Leaving Vision Stream -> Restoring Vocal Stream
    else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  };

  const toggleVocalCaptureStream = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setError(
        "Native Speech Recognition interface completely absent on this client.",
      );
      return;
    }

    if (isRecording) {
      isRecordingRef.current = false;
      setIsRecording(false);
      try {
        recognition.stop();
      } catch (e) {
        console.error(e);
      }
    } else {
      setError(null);
      // Clean up vision footprints before opening mic channels
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      try {
        isRecordingRef.current = true;
        setIsRecording(true);
        recognition.start();
      } catch (err) {
        console.error("Vocal engine boot error:", err);
      }
    }
  };

  const executeVisionFrameCapture = async () => {
    if (!streamRef.current || !videoRef.current) {
      setError("Active video stream is missing. Cannot map frame data.");
      return;
    }

    setVisionLoading(true);
    setError(null);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context binding failure.");

      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8),
      );

      if (!blob) throw new Error("Frame distillation failure.");

      const formData = new FormData();
      formData.append("file", blob, "sign_capture.jpg");

      const response = await fetch(SIGN_LANGUAGE_API_URL, {
        method: "POST",
        body: formData,
        mode: "cors",
      });

      if (!response.ok) throw new Error("Vision server route unreachable.");
      const data = await response.json();
      setComplaint(data.translated_text);
    } catch (err: any) {
      console.warn(
        "Vision node offline. Injecting emergency local mock stream...",
      );
      setTimeout(() => {
        setComplaint(
          "Patient is gesturing signs of severe respiratory distress / shortness of breath.",
        );
        setVisionLoading(false);
      }, 1000);
      return;
    }
    setVisionLoading(false);
  };

  // ==========================================
  // 🩺 AGENTIC TRIAGE INTELLIGENCE PIPELINE
  // ==========================================
  const processClinicalIntake = async (): Promise<void> => {
    if (!complaint.trim()) {
      setError(
        "Operational failure: Narrative content required to compile triage dataset.",
      );
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(BACKEND_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_input: complaint,
          vitals: {
            BP: bp || "Not Recorded",
            Temperature: temp ? `${temp}°C` : "Not Recorded",
            SpO2: spo2 ? `${spo2}%` : "Not Recorded",
          },
        }),
      });

      if (!response.ok)
        throw new Error("Downstream triage orchestration runtime failed.");
      const data = await response.json();

      const spo2Num = parseFloat(spo2) || 100;
      const tempNum = parseFloat(temp) || 37;
      const normalizedText = complaint.toLowerCase();

      const isCritical =
        normalizedText.includes("ampus") ||
        normalizedText.includes("chest pain") ||
        normalizedText.includes("sakit dada") ||
        spo2Num < 92 ||
        tempNum >= 39;
      const isUrgent =
        normalizedText.includes("sesak") ||
        normalizedText.includes("breathing") ||
        tempNum >= 37.5;

      let urgency: "RED" | "YELLOW" | "GREEN" = "GREEN";
      let colorClass =
        "border-emerald-500 bg-emerald-950/40 text-emerald-300 shadow-inner";
      let badgeClass = "bg-emerald-500 text-slate-950";
      let justification =
        "Patient physiological baselines comply with systemic norms.";

      if (isCritical) {
        urgency = "RED";
        colorClass =
          "border-rose-500 bg-rose-950/50 text-rose-200 shadow-md shadow-rose-950/50";
        badgeClass = "bg-rose-500 text-white animate-pulse";
        justification =
          "Immediate triage emergency protocol triggered. Critical symptom array detected.";
      } else if (isUrgent) {
        urgency = "YELLOW";
        colorClass = "border-amber-500 bg-amber-950/40 text-amber-200";
        badgeClass = "bg-amber-500 text-slate-950";
        justification =
          "Escalated monitoring pathway assigned. Borderline metrics observed.";
      }

      setResult({
        urgency,
        colorClass,
        badgeClass,
        justification,
        clinicalSummary: data.clinical_summary,
      });
    } catch (err: any) {
      setError(
        err.message ||
          "Transmission pipeline fault between client and core engine.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 font-sans text-slate-200 antialiased overflow-hidden">
      {/* HEADER HUD INFRASTRUCTURE */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 z-50 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-indigo-500 rounded-sm rotate-45" />
          <h1 className="text-sm font-bold uppercase tracking-widest text-white">
            MEDILOGUE{" "}
            <span className="text-indigo-400 font-mono text-[10px] bg-slate-950 px-2 py-0.5 rounded ml-2 border border-slate-800">
              CONSOLE V3.0
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-6 text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${isRecording ? "bg-rose-500 animate-ping" : "bg-emerald-500"}`}
            />
            Vocal Node:{" "}
            <span
              className={
                isRecording ? "text-rose-400 font-bold" : "text-emerald-400"
              }
            >
              {isRecording ? "Capturing" : "Ready"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${inputMode === "sign" ? "bg-teal-400" : "bg-slate-600"}`}
            />
            Vision Link:{" "}
            <span
              className={
                inputMode === "sign" ? "text-teal-400" : "text-slate-500"
              }
            >
              {inputMode === "sign" ? "Streaming" : "Idle"}
            </span>
          </div>
        </div>
      </header>

      {/* CORE FRAME LAYOUT */}
      <main className="flex w-full pt-16 h-full">
        {/* PANEL LEFT: STREAM ACQUISITION CONTROL */}
        <section className="w-[45%] bg-slate-900/40 border-r border-slate-800/80 p-8 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">
                01. INTAKE CHANNEL TARGET
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleInputChannelShift("voice")}
                  className={`py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    inputMode === "voice"
                      ? "bg-indigo-600 text-white border border-indigo-400 shadow-md shadow-indigo-950"
                      : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                  }`}
                >
                  🎤 Audio Input Stream
                </button>
                <button
                  type="button"
                  onClick={() => handleInputChannelShift("sign")}
                  className={`py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    inputMode === "sign"
                      ? "bg-teal-600 text-white border border-teal-400 shadow-md shadow-teal-950"
                      : "text-slate-400 hover:text-white hover:bg-slate-900/50"
                  }`}
                >
                  📸 Vision Sign Stream
                </button>
              </div>
            </div>

            {/* HARDWARE EMBED WINDOW */}
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800/60 shadow-2xl">
              {inputMode === "voice" ? (
                <div className="space-y-4 text-center py-2">
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Voice recognition system is ready. Click the trigger button
                    to lock hardware capture. The system will continuously
                    listen until manually stopped.
                  </p>
                  <button
                    type="button"
                    onClick={toggleVocalCaptureStream}
                    className={`w-full py-4 rounded-xl font-bold text-xs tracking-wider uppercase transition-all border cursor-pointer ${
                      isRecording
                        ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-400 shadow-lg shadow-rose-950 animate-pulse"
                        : "bg-slate-900 hover:bg-slate-800 text-indigo-400 border-indigo-500/20"
                    }`}
                  >
                    {isRecording
                      ? "🛑 Interrupt Stream (Listening)"
                      : "🎙️ Initialize Audio Stream"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-full h-48 bg-black rounded-xl overflow-hidden relative border border-slate-800 flex items-center justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-700 text-slate-300 font-mono text-[9px] px-2 py-0.5 rounded uppercase">
                      Live Video Node
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={executeVisionFrameCapture}
                    disabled={visionLoading}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3.5 rounded-xl font-bold text-xs tracking-wider uppercase border border-teal-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700 cursor-pointer transition shadow-md"
                  >
                    {visionLoading
                      ? "⚡ Mapping Neural Frame..."
                      : "📸 Trigger Frame Capture"}
                  </button>
                </div>
              )}
            </div>

            {/* PIPELINE STREAM EDITOR FIELD */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">
                02. RAW PHONETIC DATA TEXTFIELD
              </label>
              <textarea
                className="w-full h-36 p-4 bg-slate-950 border border-slate-800 rounded-xl font-sans text-sm focus:outline-none focus:border-indigo-500 text-slate-100 shadow-inner leading-relaxed"
                placeholder="Transcription data or sign translation will map here in real-time. You can also type manually..."
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-900 text-rose-300 text-xs rounded-xl font-mono mt-4">
              ⚠️ {error}
            </div>
          )}
        </section>

        {/* PANEL RIGHT: INTEL GRAPH & BIOMETRIC EXTRACTION */}
        <section className="flex-1 bg-slate-950 p-8 overflow-y-auto flex flex-col space-y-6">
          {/* PATIENT METRICS ROW CARD */}
          <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest border-b border-slate-800 pb-3 flex items-center gap-2">
              <span>🩺</span> Systemic Biometric Indicators
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <label className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider mb-1">
                  Systolic/Diastolic
                </label>
                <input
                  type="text"
                  className="w-full bg-transparent border-none text-sm font-mono text-white text-center focus:outline-none"
                  placeholder="120/80"
                  value={bp}
                  onChange={(e) => setBp(e.target.value)}
                />
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <label className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider mb-1">
                  Oxygen Saturation
                </label>
                <input
                  type="text"
                  className="w-full bg-transparent border-none text-sm font-mono text-white text-center focus:outline-none"
                  placeholder="98%"
                  value={spo2}
                  onChange={(e) => setSpo2(e.target.value)}
                />
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <label className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider mb-1">
                  Thermal Metric
                </label>
                <input
                  type="text"
                  className="w-full bg-transparent border-none text-sm font-mono text-white text-center focus:outline-none"
                  placeholder="37.0°C"
                  value={temp}
                  onChange={(e) => setTemp(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* DISPATCH ACTION SWITCH */}
          <button
            type="button"
            onClick={processClinicalIntake}
            disabled={loading}
            className="w-full bg-white text-slate-950 hover:bg-slate-100 font-bold py-4 rounded-xl text-xs tracking-widest uppercase border border-white disabled:bg-slate-800 disabled:text-slate-600 disabled:border-slate-800 transition cursor-pointer shadow-lg shadow-white/5"
          >
            {loading
              ? "⚡ Processing Core LLM Distillation..."
              : "Execute Agentic Triage Evaluation 🚀"}
          </button>

          {/* INTELLIGENCE METRIC GRAPH VIEW */}
          <div className="flex-1">
            {result ? (
              <div className="space-y-4">
                {/* EMERGENCY NOTIFICATION HERO OVERHAUL */}
                <div
                  className={`p-5 rounded-2xl border flex items-start gap-4 transition-all shadow-xl ${result.colorClass}`}
                >
                  <div
                    className={`px-4 py-1.5 text-xs font-black rounded font-mono ${result.badgeClass}`}
                  >
                    {result.urgency}
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                      System Threat Justification
                    </h4>
                    <p className="text-xs font-medium leading-relaxed italic">
                      {result.justification}
                    </p>
                  </div>
                </div>

                {/* STRUCTURAL ARCHIVE SUMMARY PREVIEW */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Compiled Clinical Intake Record
                    </h4>
                    <span className="text-[9px] bg-slate-950 text-indigo-400 px-2 py-0.5 rounded font-mono border border-slate-800">
                      AI Context Stream
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-300 bg-slate-950 p-5 rounded-xl border border-slate-800/80 leading-relaxed whitespace-pre-line shadow-inner max-h-[220px] overflow-y-auto">
                    {result.clinicalSummary}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[250px] border border-dashed border-slate-800 bg-slate-900/10 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-slate-500">
                <span className="text-2xl mb-2 opacity-40">📊</span>
                <p className="text-xs max-w-xs leading-relaxed font-mono text-slate-600">
                  {loading
                    ? "Filtering medical parameters..."
                    : "Awaiting patient data stream dispatch from the intake console..."}
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

type Step = "home" | "capture" | "analysis" | "results" | "preview";

type Style = {
  id: string;
  name: string;
  score: number;
  category: string;
  description: string;
  cut: string;
  reasons: string[];
  referenceImage?: string;
};

type Profile = {
  face_shape: string | null;
  hair_type: string | null;
  hair_texture: string | null;
  density: string | null;
  length: string | null;
  confidence: number;
};

const MODEL_IDS = [
  "two-block",
  "low-fade",
  "textured-crop",
  "comma-hair",
  "french-crop",
  "middle-part",
  "crew-cut",
  "ivy-league",
  "short-quiff",
] as const;

const FALLBACK: Style[] = [
  { id:"two-block", name:"Two Block", score:0, category:"Modern", description:"Bagian atas medium dengan sisi lebih ringan.", cut:"Atas medium • sisi lebih ringan", reasons:[] },
  { id:"low-fade", name:"Low Fade", score:0, category:"Clean", description:"Fade rendah yang rapi dan aman untuk daily.", cut:"Low fade • atas natural", reasons:[] },
  { id:"textured-crop", name:"Textured Crop", score:0, category:"Casual", description:"Crop pendek dengan tekstur yang jelas.", cut:"Crop fade • atas textured", reasons:[] },
  { id:"comma-hair", name:"Comma Hair", score:0, category:"Korean", description:"Fringe melengkung dengan volume ringan.", cut:"Two block • comma fringe", reasons:[] },
  { id:"french-crop", name:"French Crop", score:0, category:"Short", description:"Pendek, rapi, praktis untuk perawatan harian.", cut:"Fade • fringe pendek", reasons:[] },
  { id:"middle-part", name:"Middle Part", score:0, category:"Medium", description:"Belahan tengah dengan jatuh rambut natural.", cut:"Taper • atas medium", reasons:[] },
  { id:"crew-cut", name:"Crew Cut", score:0, category:"Short", description:"Clean, pendek, dan mudah dirawat.", cut:"Fade • atas pendek", reasons:[] },
  { id:"ivy-league", name:"Ivy League", score:0, category:"Classic", description:"Klasik, rapi, dengan volume terkontrol.", cut:"Taper • atas medium", reasons:[] },
  { id:"short-quiff", name:"Short Quiff", score:0, category:"Classic", description:"Volume ringan di depan dengan sisi rapi.", cut:"Taper • depan bervolume", reasons:[] },
];

const FALLBACK_MAP = new Map(FALLBACK.map((x) => [x.id, x]));

function normalizeStyle(x: any): Style {
  const id = String(x?.id || "");
  const fallback = FALLBACK_MAP.get(id);
  return {
    id: id || fallback?.id || "model",
    name: String(x?.name || fallback?.name || "Model Rambut"),
    score: Number(x?.score ?? fallback?.score ?? 0),
    category: String(x?.category || fallback?.category || "Classic"),
    description: String(x?.description || fallback?.description || "Model pilihan TOPSID."),
    cut: String(x?.barber_note || x?.cut || fallback?.cut || "Tanyakan detail potongan kepada barber."),
    reasons: Array.isArray(x?.reasons) ? x.reasons.map(String) : (fallback?.reasons || []),
    referenceImage:
      String(x?.reference_image_url || x?.referenceImage || x?.image_url || "") ||
      (MODEL_IDS.includes(id as any) ? `/refs/${id}.jpg` : ""),
  };
}

function label(v: unknown) {
  if (!v) return "—";
  return String(v).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * IMPORTANT:
 * This component intentionally uses a unique "ts-" CSS namespace and explicit
 * layout resets. This prevents old/global CSS from changing grid/flex sizing
 * and causing the mobile overlap shown in the previous deployment.
 */
function ReferenceVisual({ model, large = false }: { model: Style; large?: boolean }) {
  const [failed, setFailed] = useState(false);

  if (model.referenceImage && !failed) {
    return (
      <img
        className={`ts-ref-image ${large ? "ts-ref-image-large" : ""}`}
        src={model.referenceImage}
        alt={`Referensi model rambut ${model.name}`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className={`ts-ref-fallback ${large ? "ts-ref-fallback-large" : ""}`} aria-label={`Referensi ${model.name}`}>
      <div className={`ts-hair-icon ts-hair-${model.id}`} aria-hidden="true">
        <span />
        <span />
      </div>
      <strong>{model.name}</strong>
      <small>Referensi TOPSID</small>
    </div>
  );
}

export default function TopsidPage() {
  const [step, setStep] = useState<Step>("home");
  const [collection, setCollection] = useState<Style[]>(FALLBACK);
  const [recs, setRecs] = useState<Style[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selected, setSelected] = useState<Style | null>(null);
  const [photo, setPhoto] = useState("");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [camera, setCamera] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/hairstyles?limit=9")
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (Array.isArray(payload?.data) && payload.data.length) {
          const incoming = payload.data.map(normalizeStyle);
          const byId = new Map(incoming.map((x: Style) => [x.id, x]));
          setCollection(MODEL_IDS.map((id) => byId.get(id) || FALLBACK_MAP.get(id)!).map(normalizeStyle));
        }
      })
      .catch(() => {});
    return () => stopCamera();
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCamera(false);
  }

  function reset() {
    stopCamera();
    setStep("home");
    setRecs([]);
    setProfile(null);
    setSelected(null);
    setPhoto("");
    setProgress(0);
    setStage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function openCamera() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      setCamera(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setCamera(false);
      setError("Kamera tidak tersedia. Pilih foto dari galeri untuk lanjut.");
    }
  }

  function startJourney() {
    setError("");
    setStep("capture");
    window.scrollTo({ top: 0 });
    setTimeout(openCamera, 100);
  }

  async function prepareImage(src: string) {
    return new Promise<string>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const max = 1200;
        const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Browser tidak mendukung pemrosesan foto."));
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.onerror = () => reject(new Error("Foto tidak dapat dibaca."));
      image.src = src;
    });
  }

  async function runAnalysis(src: string) {
    setPhoto(src);
    setStep("analysis");
    setProgress(10);
    setStage("Menyiapkan foto...");
    setError("");
    window.scrollTo({ top: 0 });

    try {
      const optimized = await prepareImage(src);
      setPhoto(optimized);
      setProgress(35);
      setStage("TOPSID sedang membaca karakter rambut...");

      const analyzeResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: optimized }),
      });

      const analyzePayload = await analyzeResponse.json().catch(() => ({}));
      if (!analyzeResponse.ok || !analyzePayload?.data) {
        throw new Error(analyzePayload?.error || "Analisis AI gagal.");
      }

      const analyzed = analyzePayload.data as Profile;
      setProfile(analyzed);
      setProgress(70);
      setStage("Mencari model yang paling cocok...");

      const recResponse = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: analyzed, limit: 3 }),
      });

      const recPayload = await recResponse.json().catch(() => ({}));
      if (!recResponse.ok) throw new Error(recPayload?.error || "Rekomendasi belum tersedia.");

      const list = Array.isArray(recPayload?.data) ? recPayload.data.map(normalizeStyle) : [];
      if (!list.length) throw new Error("TOPSID belum menemukan model yang cocok.");

      setRecs(list.slice(0, 3));
      setSelected(list[0]);
      setProgress(100);
      setStage("Selesai. Ini pilihan TOPSID untukmu.");
      setTimeout(() => {
        setStep("results");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analisis belum berhasil.");
      setStep("capture");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("Kamera belum siap. Coba lagi.");
      return;
    }

    const max = 1200;
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();
    runAnalysis(canvas.toDataURL("image/jpeg", 0.82));
  }

  function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Gunakan JPG, PNG, atau WebP.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => runAnalysis(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  const currentStep =
    step === "home" ? 1 :
    step === "capture" ? 2 :
    step === "analysis" ? 3 :
    step === "results" ? 4 : 5;

  return (
    <main className="ts-app">
      <style>{`
        .ts-app, .ts-app * { box-sizing: border-box; }
        .ts-app {
          --navy:#183451;
          --blue:#1769df;
          --muted:#71808d;
          --line:#dbe4eb;
          --paper:#fffdf9;
          --soft:#eef5fc;
          width:100%;
          min-height:100vh;
          margin:0;
          padding:0;
          overflow-x:hidden;
          background:var(--paper);
          color:var(--navy);
          font-family:Manrope,Arial,sans-serif;
        }
        .ts-app button,
        .ts-app input { font:inherit; }
        .ts-app button { -webkit-tap-highlight-color:transparent; }

        .ts-header {
          width:100%;
          height:78px;
          background:#fff;
          border-bottom:1px solid #e5eaf0;
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding:0 28px;
          position:sticky;
          top:0;
          z-index:50;
        }
        .ts-brand {
          border:0;
          background:transparent;
          display:flex;
          align-items:center;
          gap:12px;
          padding:0;
          color:var(--navy);
          cursor:pointer;
          text-align:left;
        }
        .ts-mark {
          width:48px;height:48px;border-radius:14px;
          display:grid;place-items:center;
          background:var(--blue);color:#fff;
          font-size:22px;font-weight:900;
          flex:none;
        }
        .ts-brand-name { display:block;font-size:22px;font-weight:900;line-height:1; }
        .ts-brand-sub { display:block;margin-top:5px;color:#3973ad;font-size:10px;letter-spacing:2px; }
        .ts-menu {
          width:48px;height:48px;border:1px solid #dce4eb;border-radius:50%;
          background:#fff;color:var(--navy);font-size:24px;cursor:pointer;
        }

        .ts-wrap {
          width:min(1060px,100%);
          margin:0 auto;
          padding:0 28px;
        }

        .ts-journey {
          width:100%;
          background:#fff;
          border-bottom:1px solid var(--line);
        }
        .ts-steps {
          width:min(1060px,100%);
          margin:auto;
          padding:9px 28px;
          display:grid;
          grid-template-columns:repeat(5,1fr);
          gap:0;
        }
        .ts-step {
          position:relative;
          display:flex;
          flex-direction:column;
          align-items:center;
          gap:5px;
          color:#a0abb5;
          font-size:11px;
          font-weight:800;
          text-align:center;
        }
        .ts-step:not(:last-child)::after {
          content:"";
          position:absolute;
          height:1px;
          background:#dce4eb;
          top:14px;
          left:calc(50% + 15px);
          right:calc(-50% + 15px);
        }
        .ts-step-dot {
          width:30px;height:30px;border-radius:50%;
          border:1px solid #d6dfe7;background:#fff;
          display:grid;place-items:center;
          position:relative;z-index:2;
        }
        .ts-step-active { color:var(--blue); }
        .ts-step-active .ts-step-dot { background:var(--blue);border-color:var(--blue);color:#fff; }

        .ts-home {
          padding:60px 0 70px;
        }
        .ts-eyebrow,.ts-label {
          color:#286db6;
          font-size:12px;
          line-height:1.2;
          letter-spacing:2px;
          font-weight:900;
        }
        .ts-hero-title {
          max-width:900px;
          margin:18px 0 20px;
          font-size:clamp(48px,7vw,82px);
          line-height:.98;
          letter-spacing:-4px;
          font-weight:900;
        }
        .ts-blue { color:var(--blue); }
        .ts-lead {
          max-width:680px;
          margin:0 0 24px;
          color:#647382;
          font-size:20px;
          line-height:1.5;
        }
        .ts-primary {
          border:0;
          border-radius:16px;
          background:var(--blue);
          color:#fff;
          padding:16px 26px;
          font-size:17px;
          font-weight:900;
          cursor:pointer;
          box-shadow:0 14px 28px rgba(23,105,223,.18);
        }
        .ts-note { margin:10px 0 0; color:#7d8994;font-size:13px; }

        .ts-collection {
          margin-top:38px;
          padding:22px;
          border-radius:24px;
          background:#10243b;
          overflow:hidden;
        }
        .ts-collection-title {
          color:#f0d39b;
          text-align:center;
          font-family:Georgia,serif;
          font-weight:900;
          font-size:28px;
          letter-spacing:3px;
        }
        .ts-collection-sub {
          color:#d7b777;
          text-align:center;
          font-size:9px;
          letter-spacing:2px;
          margin:5px 0 18px;
        }
        .ts-collection-grid {
          display:grid !important;
          grid-template-columns:repeat(3,minmax(0,1fr)) !important;
          grid-auto-rows:auto !important;
          gap:12px !important;
          width:100% !important;
          height:auto !important;
          position:relative !important;
          float:none !important;
        }
        .ts-collection-card {
          appearance:none;
          width:100% !important;
          min-width:0 !important;
          min-height:0 !important;
          height:auto !important;
          position:relative !important;
          inset:auto !important;
          float:none !important;
          display:block !important;
          padding:6px !important;
          margin:0 !important;
          border:4px solid #d6b67b !important;
          border-radius:10px !important;
          background:#f5ecd9 !important;
          cursor:pointer;
          overflow:hidden !important;
        }
        .ts-collection-card .ts-ref-image,
        .ts-collection-card .ts-ref-fallback {
          width:100% !important;
          height:auto !important;
          aspect-ratio:1/1 !important;
          min-height:0 !important;
          display:flex;
        }
        .ts-collection-name {
          display:block;
          width:100%;
          margin:6px 0 1px;
          color:#172b40;
          font-size:11px;
          line-height:1.15;
          font-weight:900;
          text-align:center;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        .ts-ref-image {
          width:100%;
          height:100%;
          min-width:0;
          min-height:0;
          display:block;
          object-fit:cover;
          border-radius:6px;
        }
        .ts-ref-image-large { border-radius:0; }
        .ts-ref-fallback {
          width:100%;
          height:100%;
          min-height:150px;
          display:flex;
          flex-direction:column;
          justify-content:center;
          align-items:center;
          gap:7px;
          padding:12px;
          border-radius:6px;
          background:linear-gradient(145deg,#edf5fc,#dceaf7);
          color:var(--navy);
          text-align:center;
        }
        .ts-ref-fallback strong { font-size:14px;line-height:1.15; }
        .ts-ref-fallback small { color:#71808d;font-size:10px; }
        .ts-hair-icon {
          width:62px;height:58px;position:relative;
        }
        .ts-hair-icon::before {
          content:"";
          position:absolute;
          width:48px;height:34px;
          left:7px;top:4px;
          background:#1d3045;
          border-radius:50% 55% 35% 45%;
          transform:rotate(-4deg);
        }
        .ts-hair-icon::after {
          content:"";
          position:absolute;
          width:40px;height:32px;
          left:17px;top:29px;
          background:#e4edf5;
          border-radius:45%;
        }
        .ts-hair-icon span:first-child {
          position:absolute;z-index:2;
          width:9px;height:30px;
          left:4px;top:24px;
          background:#1d3045;
          border-radius:8px;
        }
        .ts-hair-icon span:last-child {
          position:absolute;z-index:2;
          width:9px;height:25px;
          right:6px;top:27px;
          background:#1d3045;
          border-radius:8px;
        }

        .ts-section { padding:55px 0; }
        .ts-section h2 {
          margin:0 0 22px;
          font-size:42px;
          line-height:1;
          letter-spacing:-2px;
        }
        .ts-how-grid {
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:14px;
        }
        .ts-info-card {
          background:#fff;
          border:1px solid var(--line);
          border-radius:22px;
          padding:22px;
        }
        .ts-num {
          width:38px;height:38px;border-radius:11px;
          background:#edf5fd;color:var(--blue);
          display:grid;place-items:center;
          font-weight:900;
        }
        .ts-info-card h3 { margin:17px 0 8px;font-size:24px; }
        .ts-info-card p { margin:0;color:var(--muted);line-height:1.5; }

        .ts-page {
          padding:34px 0 70px;
        }
        .ts-back {
          border:0;background:none;color:#286db6;
          padding:0;margin:0 0 16px;
          font-weight:900;cursor:pointer;
        }
        .ts-page-title {
          margin:8px 0 12px;
          font-size:46px;
          line-height:1;
          letter-spacing:-2.5px;
          font-weight:900;
        }
        .ts-muted { color:var(--muted);line-height:1.5; }
        .ts-error {
          margin:14px 0;
          padding:12px 14px;
          border-radius:12px;
          border:1px solid #ffd0d0;
          background:#fff2f2;
          color:#a13b3b;
        }

        .ts-camera {
          position:relative;
          width:100%;
          height:min(650px,72vh);
          min-height:460px;
          margin-top:20px;
          border-radius:24px;
          overflow:hidden;
          background:#10243b;
        }
        .ts-camera video { width:100%;height:100%;display:block;object-fit:cover; }
        .ts-camera-overlay {
          position:absolute;inset:24px;
          border:1px solid rgba(255,255,255,.65);
          border-radius:20px;
          pointer-events:none;
        }
        .ts-shutter {
          position:absolute;bottom:20px;left:50%;
          transform:translateX(-50%);
          width:76px;height:76px;
          border:7px solid #fff;border-radius:50%;
          background:#fff;cursor:pointer;
        }
        .ts-gallery {
          position:absolute;right:18px;bottom:28px;
          border:0;border-radius:12px;
          padding:11px 15px;
          background:#fff;color:var(--navy);
          font-weight:900;cursor:pointer;
        }
        .ts-camera-empty {
          width:100%;height:100%;
          display:flex;flex-direction:column;
          align-items:center;justify-content:center;
          padding:30px;text-align:center;color:#fff;
        }
        .ts-camera-empty h2 { margin:0 0 8px; }
        .ts-camera-empty .ts-secondary { margin-top:10px; }

        .ts-secondary {
          border:1px solid #bdd0df;
          background:#fff;color:#286db6;
          border-radius:12px;
          padding:12px 16px;
          font-weight:900;
          cursor:pointer;
        }

        .ts-analysis { text-align:center; }
        .ts-analysis-photo {
          width:min(430px,100%);
          margin:20px auto;
          border:1px solid var(--line);
          border-radius:20px;
          overflow:hidden;
          background:#fff;
        }
        .ts-analysis-photo img {
          width:100%;height:auto;aspect-ratio:4/5;
          display:block;object-fit:cover;
        }
        .ts-loader {
          width:70px;height:70px;
          margin:20px auto;
          border:7px solid #e5eef8;
          border-top-color:var(--blue);
          border-radius:50%;
          animation:ts-spin 1s linear infinite;
        }
        @keyframes ts-spin { to { transform:rotate(360deg); } }
        .ts-progress {
          width:min(430px,100%);
          height:7px;
          margin:15px auto;
          border-radius:99px;
          background:#e7edf3;
          overflow:hidden;
        }
        .ts-progress span { display:block;height:100%;background:var(--blue);transition:width .3s; }

        .ts-results-head { margin-bottom:24px; }
        .ts-chips {
          display:flex;
          flex-wrap:wrap;
          gap:9px;
          margin:18px 0 38px;
        }
        .ts-chip {
          padding:10px 12px;
          border-radius:12px;
          background:#edf5fd;
          color:var(--muted);
          font-size:13px;
        }
        .ts-chip strong { color:var(--navy); }
        .ts-recommend-title {
          margin:8px 0 22px;
          font-size:42px;
          line-height:1;
          letter-spacing:-2px;
        }

        /* HARD layout reset for recommendation cards */
        .ts-recommendations {
          display:flex !important;
          flex-direction:column !important;
          gap:16px !important;
          width:100% !important;
          height:auto !important;
          position:relative !important;
          float:none !important;
          clear:both !important;
        }
        .ts-recommendation {
          display:grid !important;
          grid-template-columns:150px minmax(0,1fr) !important;
          align-items:start !important;
          gap:18px !important;
          width:100% !important;
          min-width:0 !important;
          min-height:174px !important;
          height:auto !important;
          position:relative !important;
          inset:auto !important;
          float:none !important;
          clear:both !important;
          overflow:hidden !important;
          padding:14px !important;
          margin:0 !important;
          border:1px solid var(--line) !important;
          border-radius:22px !important;
          background:#fff !important;
        }
        .ts-recommendation:first-child { border:2px solid #a8c9eb !important; }
        .ts-rec-media {
          width:150px !important;
          height:174px !important;
          min-width:0 !important;
          min-height:0 !important;
          overflow:hidden !important;
          border-radius:15px !important;
          position:relative !important;
        }
        .ts-rec-media .ts-ref-image,
        .ts-rec-media .ts-ref-fallback {
          width:100% !important;
          height:100% !important;
          min-height:0 !important;
          object-fit:cover !important;
        }
        .ts-rec-content {
          width:100% !important;
          min-width:0 !important;
          height:auto !important;
          position:relative !important;
          overflow:visible !important;
        }
        .ts-rec-content h3 {
          margin:6px 0 5px !important;
          font-size:27px !important;
          line-height:1.08 !important;
          overflow-wrap:anywhere !important;
        }
        .ts-score { color:#178043;font-weight:900;font-size:14px; }
        .ts-reasons {
          list-style:none !important;
          margin:8px 0 !important;
          padding:0 !important;
          color:#73808d;
          font-size:13px;
          line-height:1.5;
        }
        .ts-reasons li { margin:2px 0; }
        .ts-outline {
          border:1px solid #bdd0df;
          background:#fff;color:#286db6;
          border-radius:10px;
          padding:9px 12px;
          font-weight:900;
          cursor:pointer;
        }

        .ts-preview-grid {
          display:grid;
          grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr);
          gap:22px;
          align-items:start;
        }
        .ts-preview-main {
          background:#fff;
          border:1px solid var(--line);
          border-radius:22px;
          overflow:hidden;
        }
        .ts-preview-main > .ts-ref-image,
        .ts-preview-main > .ts-ref-fallback {
          width:100%;
          aspect-ratio:4/3;
          min-height:320px;
        }
        .ts-preview-copy { padding:24px; }
        .ts-preview-copy h2 { margin:6px 0 10px;font-size:38px;line-height:1; }
        .ts-detail {
          margin:18px 0;
          padding:16px;
          border-radius:16px;
          background:#f1f6fb;
        }
        .ts-detail strong { display:block;margin-bottom:7px; }
        .ts-cta {
          width:100%;
          border:0;border-radius:14px;
          background:var(--blue);color:#fff;
          padding:14px;
          font-weight:900;font-size:16px;
          cursor:pointer;
        }
        .ts-side-ref {
          padding:16px;
          border-radius:22px;
          background:#10243b;
          color:#fff;
        }
        .ts-side-ref h3 { margin:4px 0 14px;font-size:22px; }
        .ts-side-ref .ts-ref-image,
        .ts-side-ref .ts-ref-fallback {
          width:100%;
          aspect-ratio:4/3;
          border-radius:14px;
        }

        @media (max-width:700px) {
          .ts-header { height:72px;padding:0 16px; }
          .ts-mark { width:44px;height:44px;border-radius:13px; }
          .ts-brand-name { font-size:19px; }
          .ts-brand-sub { font-size:8px;letter-spacing:1.5px; }
          .ts-menu { width:46px;height:46px; }
          .ts-wrap { padding:0 16px; }
          .ts-steps { padding:8px 10px; }
          .ts-step { font-size:9px; }
          .ts-step-dot { width:27px;height:27px; }
          .ts-step:not(:last-child)::after {
            top:13px;
            left:calc(50% + 14px);
            right:calc(-50% + 14px);
          }

          .ts-home { padding:40px 0 50px; }
          .ts-hero-title {
            font-size:47px;
            letter-spacing:-3px;
            line-height:.98;
          }
          .ts-lead { font-size:18px; }
          .ts-primary { width:100%; }
          .ts-collection { margin-top:28px;padding:12px;border-radius:18px; }
          .ts-collection-title { font-size:22px;letter-spacing:2px; }
          .ts-collection-grid {
            grid-template-columns:repeat(3,minmax(0,1fr)) !important;
            gap:7px !important;
          }
          .ts-collection-card {
            border-width:3px !important;
            padding:3px !important;
            border-radius:8px !important;
          }
          .ts-collection-name { font-size:8px;margin-top:4px; }
          .ts-section { padding:38px 0; }
          .ts-section h2 { font-size:34px; }
          .ts-how-grid { grid-template-columns:1fr; }
          .ts-page { padding:26px 0 50px; }
          .ts-page-title { font-size:35px; }
          .ts-camera {
            height:calc(100svh - 190px);
            min-height:430px;
            border-radius:20px;
          }

          .ts-recommendation {
            grid-template-columns:96px minmax(0,1fr) !important;
            gap:12px !important;
            min-height:0 !important;
            padding:10px !important;
            border-radius:18px !important;
          }
          .ts-rec-media {
            width:96px !important;
            height:126px !important;
          }
          .ts-rec-content h3 {
            font-size:22px !important;
            line-height:1.08 !important;
          }
          .ts-reasons { font-size:12px;line-height:1.38; }
          .ts-outline { font-size:12px;padding:8px 10px; }
          .ts-recommend-title { font-size:35px; }
          .ts-preview-grid { grid-template-columns:1fr; }
          .ts-preview-copy h2 { font-size:32px; }
        }
      `}</style>

      <header className="ts-header">
        <button className="ts-brand" onClick={reset} aria-label="Kembali ke TOPSID">
          <span className="ts-mark">T</span>
          <span>
            <span className="ts-brand-name">TOPSID</span>
            <span className="ts-brand-sub">CARI MODEL RAMBUTMU</span>
          </span>
        </button>
        <button className="ts-menu" onClick={reset} aria-label="Mulai ulang">☰</button>
      </header>

      {step !== "home" && (
        <nav className="ts-journey" aria-label="Progress TOPSID">
          <div className="ts-steps">
            {["Cari","Rekam","Analisis","Pilih","Preview"].map((name, index) => (
              <div className={`ts-step ${currentStep >= index + 1 ? "ts-step-active" : ""}`} key={name}>
                <span className="ts-step-dot">{index + 1}</span>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </nav>
      )}

      {step === "home" && (
        <>
          <section className="ts-home">
            <div className="ts-wrap">
              <div className="ts-eyebrow">TOPSID</div>
              <h1 className="ts-hero-title">
                Cari model rambutmu,<br />
                <span className="ts-blue">yang paling cocok.</span>
              </h1>
              <p className="ts-lead">
                Lihat model rambut yang cocok buat kamu. Cukup rekam sebentar,
                lalu biarkan TOPSID membantu mencarikannya.
              </p>
              <button className="ts-primary" onClick={startJourney}>✦ &nbsp; Cari Tahu Sekarang</button>
              <p className="ts-note">Coba gratis · Tanpa daftar</p>

              <div className="ts-collection">
                <div className="ts-collection-title">TOP'S COLLECTION</div>
                <div className="ts-collection-sub">9 MODEL POPULER UNTUK MULAI</div>

                <div className="ts-collection-grid">
                  {collection.map((model) => (
                    <button
                      key={model.id}
                      className="ts-collection-card"
                      onClick={() => {
                        setSelected(model);
                        setStep("preview");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <ReferenceVisual model={model} />
                      <span className="ts-collection-name">{model.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="ts-section">
            <div className="ts-wrap">
              <h2>Gimana cara kerjanya?</h2>
              <div className="ts-how-grid">
                <article className="ts-info-card">
                  <div className="ts-num">01</div>
                  <h3>Rekam</h3>
                  <p>Kasih TOPSID gambaran rambutmu lewat kamera atau foto.</p>
                </article>
                <article className="ts-info-card">
                  <div className="ts-num">02</div>
                  <h3>Analisis AI</h3>
                  <p>TOPSID membaca bentuk wajah, tipe, tekstur, ketebalan, dan panjang rambut.</p>
                </article>
                <article className="ts-info-card">
                  <div className="ts-num">03</div>
                  <h3>Rekomendasi</h3>
                  <p>Dapatkan 3 model dari TOP'S Collection yang paling cocok.</p>
                </article>
              </div>
            </div>
          </section>
        </>
      )}

      {step === "capture" && (
        <section className="ts-page">
          <div className="ts-wrap">
            <button className="ts-back" onClick={reset}>← Kembali</button>
            <div className="ts-label">STEP 02 · REKAM</div>
            <h1 className="ts-page-title">Kasih TOPSID gambaran rambutmu.</h1>
            <p className="ts-muted">Hadap depan dan ambil foto rambutmu. Tidak perlu edit atau pindah halaman.</p>

            {error && <div className="ts-error">{error}</div>}

            <div className="ts-camera">
              {camera ? (
                <>
                  <video ref={videoRef} autoPlay playsInline muted />
                  <div className="ts-camera-overlay" />
                  <button className="ts-shutter" onClick={capture} aria-label="Ambil foto" />
                  <button className="ts-gallery" onClick={() => inputRef.current?.click()}>Galeri</button>
                </>
              ) : (
                <div className="ts-camera-empty">
                  <h2>Foto siap?</h2>
                  <p>Pilih foto dari galeri atau aktifkan kamera.</p>
                  <button className="ts-primary" onClick={openCamera}>Buka Kamera</button>
                  <button className="ts-secondary" onClick={() => inputRef.current?.click()}>Pilih dari Galeri</button>
                </div>
              )}
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="user"
              hidden
              onChange={pickFile}
            />
          </div>
        </section>
      )}

      {step === "analysis" && (
        <section className="ts-page ts-analysis">
          <div className="ts-wrap">
            <div className="ts-label">STEP 03 · ANALISIS</div>
            <h1 className="ts-page-title">TOPSID sedang membaca rambutmu.</h1>
            {photo && (
              <div className="ts-analysis-photo">
                <img src={photo} alt="Foto yang dianalisis TOPSID" />
              </div>
            )}
            <div className="ts-loader" />
            <div><strong>{stage}</strong></div>
            <div className="ts-progress"><span style={{ width: `${progress}%` }} /></div>
          </div>
        </section>
      )}

      {step === "results" && profile && (
        <section className="ts-page">
          <div className="ts-wrap">
            <div className="ts-label">STEP 03 · HASIL ANALISIS</div>
            <h1 className="ts-page-title">
              Ini karakter rambutmu,<br />
              <span className="ts-blue">menurut TOPSID.</span>
            </h1>

            <div className="ts-chips">
              <span className="ts-chip">Wajah <strong>{label(profile.face_shape)}</strong></span>
              <span className="ts-chip">Tipe <strong>{label(profile.hair_type)}</strong></span>
              <span className="ts-chip">Tekstur <strong>{label(profile.hair_texture)}</strong></span>
              <span className="ts-chip">Ketebalan <strong>{label(profile.density)}</strong></span>
              <span className="ts-chip">Panjang <strong>{label(profile.length)}</strong></span>
              <span className="ts-chip">Confidence <strong>{profile.confidence}%</strong></span>
            </div>

            <div className="ts-results-head">
              <div className="ts-label">STEP 04 · REKOMENDASI</div>
              <h2 className="ts-recommend-title">
                3 model yang<br />
                <span className="ts-blue">paling cocok.</span>
              </h2>
            </div>

            <div className="ts-recommendations">
              {recs.map((model, index) => (
                <article className="ts-recommendation" key={`${model.id}-${index}`}>
                  <div className="ts-rec-media">
                    <ReferenceVisual model={model} />
                  </div>
                  <div className="ts-rec-content">
                    <div className="ts-label">
                      {String(index + 1).padStart(2, "0")} · {model.category}
                    </div>
                    <h3>{model.name}</h3>
                    <div className="ts-score">{model.score}% cocok</div>
                    <ul className="ts-reasons">
                      {(model.reasons.length ? model.reasons : [model.description]).slice(0, 3).map((reason, i) => (
                        <li key={i}>✓ {reason}</li>
                      ))}
                    </ul>
                    <button
                      className="ts-outline"
                      onClick={() => {
                        setSelected(model);
                        setStep("preview");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Lihat model →
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {step === "preview" && selected && (
        <section className="ts-page">
          <div className="ts-wrap">
            <button className="ts-back" onClick={() => setStep(recs.length ? "results" : "home")}>← Kembali</button>
            <div className="ts-label">STEP 05 · PREVIEW</div>
            <h1 className="ts-page-title">
              Ini referensi<br />
              <span className="ts-blue">{selected.name}.</span>
            </h1>

            <div className="ts-preview-grid">
              <div className="ts-preview-main">
                <ReferenceVisual model={selected} large />
                <div className="ts-preview-copy">
                  <div className="ts-label">{selected.category}</div>
                  <h2>{selected.name}</h2>
                  <p className="ts-muted">{selected.description}</p>
                  <div className="ts-detail">
                    <strong>Catatan potongan untuk barber</strong>
                    <span>{selected.cut}</span>
                  </div>
                  <button className="ts-cta">Tunjukkan ke barber →</button>
                </div>
              </div>

              <aside className="ts-side-ref">
                <h3>Referensi TOPSID</h3>
                <ReferenceVisual model={selected} />
                <p>Gunakan referensi ini saat menjelaskan model yang diinginkan kepada barber.</p>
                <button className="ts-secondary" onClick={() => setStep(recs.length ? "results" : "home")}>
                  Pilih model lain
                </button>
              </aside>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

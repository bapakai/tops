"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Step = "home" | "capture" | "analysis" | "results" | "preview" | "barber";

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
  face_shape: string;
  hair_type: string;
  hair_texture: string;
  density: string;
  length: string;
  confidence: number;
};

const REFERENCE_IMAGES: Record<string, string> = {
  "low-fade": "https://www.fashionbeans.com/wp-content/uploads/2025/09/Low_Drop_Fade_style_467_7539.png",
  "textured-crop": "https://storage.googleapis.com/msgsndr/FumCT1xSDV1AOg1t8oKL/media/689b1ae2764be36d112d01d9.png",
  "comma-hair": "https://cdn.shopify.com/s/files/1/0744/0993/5019/t/40/assets/kmh-05-comma-hair.webp?width=600",
  "french-crop": "https://barberxpert.com/wp-content/uploads/2025/08/french-crop-haircut-boys.webp",
  "middle-part": "https://media.hairtical.com/2026/03/middle-part-curtains-hair-69b39ee684dff.webp",
  "crew-cut": "https://vagazine.com/vaga_v3/wp-content/uploads/2024/01/classic-crew-cut-men-haircut.jpg",
  "curly-top": "https://liembarbershop.com/wp-content/uploads/2024/08/Curly-Top-01-e1722941339292.jpg",
};

const FALLBACK_STYLES: Style[] = [
  { id: "two-block", name: "Two Block", score: 0, category: "Modern", description: "Bagian atas medium, sisi lebih ringan.", cut: "Samping low taper • atas 5–7 cm", reasons: [] },
  { id: "low-fade", name: "Low Fade", score: 0, category: "Clean", description: "Fade rendah yang aman untuk daily.", cut: "Samping low fade • atas natural", reasons: [] },
  { id: "textured-crop", name: "Textured Crop", score: 0, category: "Casual", description: "Pendek, bertekstur, mudah ditata.", cut: "Samping crop fade • atas textured", reasons: [] },
  { id: "comma-hair", name: "Comma Hair", score: 0, category: "Korean", description: "Fringe melengkung dengan volume ringan.", cut: "Samping taper • fringe medium", reasons: [] },
  { id: "french-crop", name: "French Crop", score: 0, category: "Short", description: "Rapi, praktis, dan minim styling.", cut: "Samping fade • fringe pendek", reasons: [] },
  { id: "middle-part", name: "Middle Part", score: 0, category: "Medium", description: "Natural dengan belahan tengah.", cut: "Samping taper • atas 8–10 cm", reasons: [] },
  { id: "crew-cut", name: "Crew Cut", score: 0, category: "Short", description: "Praktis, clean, dan mudah dirawat.", cut: "Samping fade • atas pendek", reasons: [] },
  { id: "curly-top", name: "Curly Top", score: 0, category: "Curly", description: "Mempertahankan tekstur ikal alami.", cut: "Samping taper • atas natural", reasons: [] },
];

function toStyle(item: any): Style {
  const id = String(item?.id ?? "style");
  return {
    id,
    name: String(item?.name ?? "Model Rambut"),
    score: Number(item?.score ?? 0),
    category: String(item?.category ?? "Classic"),
    description: String(item?.description ?? "Model pilihan TOP'S Collection."),
    cut: String(item?.barber_note ?? item?.cut ?? "Tanyakan detail kepada barber."),
    reasons: Array.isArray(item?.reasons) ? item.reasons.map(String) : [],
    referenceImage: String(item?.reference_image_url || item?.image_url || REFERENCE_IMAGES[id] || ""),
  };
}

function prepareImage(source: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const max = 1200;
      const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Gagal menyiapkan gambar."));
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => reject(new Error("Foto tidak dapat dibaca."));
    image.src = source;
  });
}

function label(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function ReferenceImage({ style, large = false }: { style: Style; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = style.referenceImage;

  if (!src || failed) {
    return (
      <div className={`ts-ref-fallback ${large ? "large" : ""}`} aria-label={`Referensi ${style.name}`}>
        <span>{style.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
        <small>Referensi visual</small>
      </div>
    );
  }

  return (
    <img
      className={`ts-ref-image ${large ? "large" : ""}`}
      src={src}
      alt={`Referensi model rambut ${style.name}`}
      loading={large ? "eager" : "lazy"}
      onError={() => setFailed(true)}
    />
  );
}

export default function Topsid() {
  const [step, setStep] = useState<Step>("home");
  const [styles, setStyles] = useState<Style[]>(FALLBACK_STYLES);
  const [recommendations, setRecommendations] = useState<Style[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selected, setSelected] = useState<Style | null>(null);
  const [sourceImage, setSourceImage] = useState("");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua");
  const [menuOpen, setMenuOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const captureTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/hairstyles?limit=30")
      .then(async (response) => {
        if (!response.ok) throw new Error("collection failed");
        return response.json();
      })
      .then((payload) => {
        if (Array.isArray(payload?.data) && payload.data.length) {
          setStyles(payload.data.map(toStyle));
        }
      })
      .catch(() => {});

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (captureTimerRef.current) window.clearTimeout(captureTimerRef.current);
    };
  }, []);

  async function openCapture() {
    setError("");
    setStep("capture");
    setMenuOpen(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Kamera tidak tersedia di browser ini. Pilih foto dari galeri untuk lanjut.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraReady(true);
      window.setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 50);
    } catch {
      setError("Izin kamera belum aktif. Bapak bisa pilih foto dari galeri.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }

  async function analyze(image: string) {
    setSourceImage(image);
    setStep("analysis");
    setProgress(10);
    setStage("Menyiapkan foto...");
    setError("");

    try {
      const prepared = await prepareImage(image);
      setSourceImage(prepared);
      setProgress(28);
      setStage("Membaca karakter rambut...");

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: prepared }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.data) throw new Error(payload?.error || "Analisis AI gagal.");

      const detected = payload.data as Profile;
      setProfile(detected);
      setProgress(62);
      setStage("Mencari model yang paling cocok...");

      const recommendationResponse = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: detected, limit: 3 }),
      });
      const recommendationPayload = await recommendationResponse.json();
      if (!recommendationResponse.ok) throw new Error(recommendationPayload?.error || "Rekomendasi belum tersedia.");

      const items = Array.isArray(recommendationPayload?.data) ? recommendationPayload.data.map(toStyle) : [];
      if (!items.length) throw new Error("TOPSID belum menemukan model yang cocok.");

      setRecommendations(items);
      setSelected(items[0]);
      setProgress(100);
      setStage("Selesai. Ini pilihan terbaikmu.");
      window.setTimeout(() => setStep("results"), 350);
    } catch (err) {
      setProgress(0);
      setStage("");
      setError(err instanceof Error ? err.message : "Analisis belum berhasil.");
    }
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("Kamera belum siap. Coba lagi.");
      return;
    }

    const canvas = document.createElement("canvas");
    const max = 1200;
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();
    setRecording(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (captureTimerRef.current) window.clearTimeout(captureTimerRef.current);
    analyze(canvas.toDataURL("image/jpeg", 0.82));
  }

  function toggleRecording() {
    if (!cameraReady) return;
    if (recording) {
      captureFrame();
      return;
    }

    setRecording(true);
    setSeconds(0);
    timerRef.current = window.setInterval(() => setSeconds((current) => current + 1), 1000);
    captureTimerRef.current = window.setTimeout(() => captureFrame(), 4000);
  }

  function chooseFile(file?: File) {
    if (!file || !file.type.startsWith("image/")) {
      setError("Gunakan JPG, PNG, atau WebP.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => analyze(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function reset() {
    stopCamera();
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (captureTimerRef.current) window.clearTimeout(captureTimerRef.current);
    setStep("home");
    setRecommendations([]);
    setProfile(null);
    setSelected(null);
    setSourceImage("");
    setProgress(0);
    setStage("");
    setError("");
    setRecording(false);
    setSeconds(0);
  }

  function goCollection() {
    setMenuOpen(false);
    if (step !== "home") reset();
    window.setTimeout(() => document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" }), 80);
  }

  const categories = useMemo(() => ["Semua", ...Array.from(new Set(styles.map((item) => item.category)))], [styles]);
  const filtered = useMemo(
    () => styles.filter((item) => (category === "Semua" || item.category === category) && item.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8),
    [styles, category, query]
  );

  const stepIndex = { home: 0, capture: 1, analysis: 2, results: 3, preview: 4, barber: 5 }[step];

  return (
    <main className="ts-app">
      <style>{`
        .ts-app{min-height:100vh;background:#fffdf9;color:#183451;font-family:Manrope,Arial,sans-serif;overflow-x:hidden}
        .ts-header{height:76px;border-bottom:1px solid #e8edf3;display:flex;align-items:center;justify-content:space-between;padding:0 24px;background:#fff;position:sticky;top:0;z-index:20}
        .ts-brand{display:flex;align-items:center;gap:11px;border:0;background:transparent;color:#183451;padding:0;text-align:left;cursor:pointer}.ts-brand-mark{width:44px;height:44px;border-radius:13px;background:#1769df;color:#fff;display:grid;place-items:center;font-weight:800;font-size:22px}.ts-brand-name{display:block;font-size:19px;font-weight:800;letter-spacing:-.6px}.ts-brand-tag{display:block;color:#1769df;font-size:8px;letter-spacing:1.35px;margin-top:2px}.ts-menu{border:0;background:#eef6ff;color:#1769df;width:44px;height:44px;border-radius:14px;font-size:20px;cursor:pointer}.ts-menu.open{background:#1769df;color:#fff}.ts-menu-popover{position:fixed;right:18px;top:67px;z-index:30;background:#fff;border:1px solid #dce6f0;border-radius:14px;box-shadow:0 14px 35px rgba(24,52,81,.14);padding:7px;width:190px}.ts-menu-popover button{display:block;width:100%;border:0;background:#fff;text-align:left;padding:12px 11px;border-radius:9px;color:#183451;font-weight:700;font-size:11px}.ts-menu-popover button:hover{background:#f3f7fb}
        .ts-steps{display:flex;justify-content:center;gap:24px;padding:10px 16px;border-bottom:1px solid #edf1f5;overflow:auto;background:#fbfdff;position:sticky;top:76px;z-index:19}.ts-step{font-size:9px;font-weight:800;color:#a0aab7;white-space:nowrap}.ts-step b{display:inline-grid;place-items:center;width:21px;height:21px;border:1px solid #d6e0eb;border-radius:50%;margin-right:5px;font-size:8px}.ts-step.active{color:#1769df}.ts-step.active b{background:#1769df;color:#fff;border-color:#1769df}.ts-step.done{color:#6f8195}.ts-step.done b{background:#edf5ff;color:#1769df;border-color:#cfe1f7}
        .ts-home{max-width:1060px;margin:auto;padding:74px 22px 80px}.ts-hero{text-align:center;max-width:720px;margin:0 auto}.ts-kicker{color:#1769df;font-size:10px;font-weight:800;letter-spacing:1.6px}.ts-hero h1{font-size:clamp(44px,8vw,76px);line-height:.97;letter-spacing:-4px;margin:15px 0 20px;font-weight:800}.ts-hero h1 em,.ts-screen h2 em{font-style:normal;color:#1769df}.ts-hero p{max-width:620px;margin:0 auto;color:#6d7c8d;font-size:15px;line-height:1.7}.ts-cta{margin-top:28px;border:0;background:#1769df;color:#fff;border-radius:14px;padding:17px 23px;font-weight:800;font-size:14px;box-shadow:0 10px 26px rgba(23,105,223,.18);cursor:pointer}.ts-cta span{margin-left:8px}.ts-note{display:block;color:#8b98a6;font-size:10px;margin-top:10px}
        .ts-how{position:relative;max-width:780px;margin:60px auto 0;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.ts-how-line{position:absolute;left:14%;right:14%;top:13px;border-top:1px dashed #cddbea}.ts-how-item{text-align:center;position:relative}.ts-how-item>span{width:28px;height:28px;background:#eef6ff;border:1px solid #d7e7f7;border-radius:50%;display:grid;place-items:center;margin:0 auto 10px;color:#1769df;font-size:8px;font-weight:800}.ts-how-item b{font-size:11px}.ts-how-item p{margin:4px 0;color:#8492a1;font-size:10px}
        .ts-collection{margin:68px auto 0;border-radius:24px;background:#f5f8fc;border:1px solid #dce6f0;padding:26px}.ts-section-head{display:flex;justify-content:space-between;align-items:end;gap:20px}.ts-section-head h2{margin:7px 0 3px;font-size:30px;letter-spacing:-1.4px}.ts-section-head p{margin:0;color:#748394;font-size:11px}.ts-search{height:42px;border:1px solid #d6e1ec;border-radius:11px;background:#fff;padding:0 12px;outline:0;width:220px;font-size:11px;color:#183451}.ts-filters{display:flex;gap:7px;overflow:auto;margin:18px 0}.ts-filters button{white-space:nowrap;border:1px solid #d7e2ee;background:#fff;color:#718092;border-radius:20px;padding:8px 12px;font-size:9px;cursor:pointer}.ts-filters button.active{background:#1769df;color:#fff;border-color:#1769df}.ts-style-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:11px}.ts-style{background:#fff;border:1px solid #dce6f0;border-radius:16px;overflow:hidden;min-width:0}.ts-style-image{height:190px;background:#eef4f9;overflow:hidden}.ts-style-body{padding:14px}.ts-pill{color:#1769df;font-size:8px;font-weight:800;letter-spacing:.3px}.ts-style h3{margin:5px 0 4px;font-size:17px;letter-spacing:-.4px}.ts-style p{margin:0;color:#738294;font-size:10px;line-height:1.5;min-height:30px}.ts-style button{margin-top:12px;border:0;background:transparent;color:#1769df;padding:0;font-size:9px;font-weight:800;cursor:pointer}.ts-style button span{margin-left:5px}.ts-ref-image{width:100%;height:100%;display:block;object-fit:cover}.ts-ref-image.large{height:100%}.ts-ref-fallback{height:100%;display:grid;place-items:center;align-content:center;gap:5px;background:linear-gradient(135deg,#eef5ff,#dce9f8);color:#1769df;text-align:center}.ts-ref-fallback span{font-size:25px;font-weight:800}.ts-ref-fallback small{font-size:8px;color:#738294}
        .ts-screen{max-width:900px;margin:auto;padding:45px 22px 78px}.ts-back{border:0;background:transparent;color:#1769df;font-size:11px;font-weight:800;padding:0;margin-bottom:25px;cursor:pointer}.ts-screen h2{font-size:clamp(38px,7vw,62px);line-height:.98;letter-spacing:-3.5px;margin:13px 0 16px}.ts-sub{color:#6d7c8d;line-height:1.65;font-size:13px;max-width:620px}.ts-camera{height:min(68vh,600px);min-height:390px;background:#112d4c;border-radius:24px;overflow:hidden;position:relative;margin-top:25px}.ts-camera video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}.ts-guide{position:absolute;inset:9% 24%;border:2px solid rgba(255,255,255,.92);border-radius:48%}.ts-camera-hint{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);background:rgba(13,35,59,.72);color:#fff;padding:8px 12px;border-radius:20px;font-size:9px;white-space:nowrap}.ts-camera-fallback{height:100%;display:grid;place-content:center;text-align:center;color:#fff;gap:10px;padding:25px}.ts-camera-fallback strong{font-size:17px}.ts-camera-fallback span{color:#c7d6e5;font-size:11px}.ts-capture-row{display:flex;justify-content:center;align-items:center;gap:25px;margin:20px 0 8px}.ts-record{width:68px;height:68px;border-radius:50%;border:5px solid #dfe9f3;background:#fff;display:grid;place-items:center;cursor:pointer}.ts-record:disabled{opacity:.4;cursor:not-allowed}.ts-record i{width:50px;height:50px;border-radius:50%;background:#1769df}.ts-record.active i{border-radius:10px;transform:scale(.58)}.ts-timer{color:#6f7e8e;font-size:10px;width:55px;text-align:center}.ts-capture-note{text-align:center;color:#7c8997;font-size:10px}.ts-gallery{display:block;text-align:center;color:#1769df;font-size:10px;font-weight:800;margin-top:16px;cursor:pointer;border:0;background:transparent;width:100%}.ts-gallery span{margin-left:5px}.ts-hidden-input{display:none}.ts-error{background:#fff3f1;border:1px solid #efcbc6;color:#9c4137;padding:11px 13px;border-radius:11px;font-size:10px;margin-top:12px}
        .ts-analysis-layout{display:grid;grid-template-columns:300px 1fr;gap:28px;align-items:center;margin-top:32px}.ts-photo-card{height:390px;background:#eef4f9;border-radius:20px;overflow:hidden;position:relative;border:1px solid #dce6f0}.ts-photo-card img{width:100%;height:100%;object-fit:cover}.ts-photo-card>span{position:absolute;left:12px;bottom:12px;background:rgba(255,255,255,.9);border-radius:9px;padding:7px 9px;font-size:9px;font-weight:800}.ts-photo-empty{height:100%;display:grid;place-items:center;color:#8b98a6}.ts-progress-big{display:flex;align-items:baseline;gap:8px}.ts-progress-big strong{font-size:50px;letter-spacing:-3px;color:#1769df}.ts-progress-big span{font-size:10px;color:#8491a0}.ts-progress{height:7px;background:#eaf0f5;border-radius:20px;overflow:hidden;margin-top:8px}.ts-progress span{display:block;height:100%;background:#1769df;transition:width .25s}.ts-analysis-copy>p{font-size:11px;color:#6d7c8d;margin:12px 0 18px}.ts-checks{border-top:1px solid #edf1f5}.ts-checks>div{padding:12px 0;border-bottom:1px solid #edf1f5;font-size:10px;color:#68788c}.ts-checks b{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#eef6ff;color:#1769df;margin-right:8px;font-size:8px}
        .ts-result-intro{padding-bottom:28px;border-bottom:1px solid #e6edf4}.ts-profile{display:flex;flex-wrap:wrap;gap:7px;margin-top:18px}.ts-profile span{background:#edf5ff;color:#6e7d8d;border-radius:10px;padding:8px 10px;font-size:9px}.ts-profile b{color:#183451}.ts-results-title{padding:30px 0 18px}.ts-results-title p{max-width:600px;color:#748394;font-size:11px;line-height:1.6}.ts-recs{display:grid;gap:14px}.ts-rec{display:grid;grid-template-columns:280px 1fr;border:1px solid #dce6f0;border-radius:20px;background:#fff;overflow:hidden}.ts-rec.first{border:2px solid #a7c8eb;box-shadow:0 10px 28px rgba(23,105,223,.08)}.ts-rec-image{height:300px;position:relative;background:#eef4f9}.ts-rank{position:absolute;left:13px;top:13px;background:#fff;color:#1769df;border-radius:10px;padding:7px 9px;font-size:10px;font-weight:800;box-shadow:0 4px 12px rgba(24,52,81,.12)}.ts-score{position:absolute;right:13px;top:13px;background:#1769df;color:#fff;border-radius:10px;padding:7px 9px;font-size:9px;font-weight:800}.ts-rec-body{padding:22px}.ts-rec-body h3{margin:6px 0 6px;font-size:28px;letter-spacing:-1.1px}.ts-rec-body>p{margin:0;color:#718092;font-size:11px;line-height:1.55}.ts-reasons{display:grid;gap:5px;margin:15px 0;color:#657688;font-size:10px}.ts-rec-body button{border:1px solid #bfd3ee;background:#fff;color:#1769df;border-radius:10px;padding:10px 12px;font-size:9px;font-weight:800;cursor:pointer}.ts-rec-body button span{margin-left:5px}.ts-full{width:100%;margin-top:12px}.ts-secondary{border:1px solid #bfd3ee;background:#fff;color:#1769df;border-radius:10px;padding:11px 15px;font-size:10px;font-weight:800;cursor:pointer}.ts-primary{border:0;background:#1769df;color:#fff;border-radius:10px;padding:12px 16px;font-size:10px;font-weight:800;cursor:pointer}
        .ts-reference-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.8fr);gap:20px;margin-top:26px}.ts-reference-image{height:500px;border-radius:22px;overflow:hidden;background:#eef4f9;position:relative}.ts-reference-badge{position:absolute;left:14px;bottom:14px;background:#1769df;color:#fff;border-radius:10px;padding:8px 10px;font-size:9px;font-weight:800}.ts-reference-info{padding:16px 0}.ts-reference-info h3{font-size:34px;letter-spacing:-1.5px;margin:8px 0}.ts-reference-info>p{color:#718092;font-size:12px;line-height:1.6}.ts-reference-meta{margin-top:24px;border-top:1px solid #edf1f5}.ts-reference-meta>div{padding:13px 0;border-bottom:1px solid #edf1f5}.ts-reference-meta small{display:block;color:#1769df;font-size:8px;font-weight:800;letter-spacing:1px;margin-bottom:4px}.ts-reference-meta b{display:block;color:#183451;font-size:11px;line-height:1.5}.ts-reference-note{margin-top:20px;padding:16px;border-radius:15px;background:#f3f7fb;border:1px solid #dce6f0;display:grid;gap:5px}.ts-reference-note b{font-size:10px}.ts-reference-note span{color:#6d7c8d;font-size:10px;line-height:1.6}.ts-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:20px}.ts-barber-card{display:grid;grid-template-columns:190px 1fr;gap:20px;padding:18px;border:1px solid #dce6f0;border-radius:20px;background:#fff;margin-top:25px}.ts-barber-image{height:240px;border-radius:14px;overflow:hidden;background:#eef4f9}.ts-barber-card h3{font-size:28px;letter-spacing:-1px;margin:6px 0}.ts-barber-card p{color:#718092;font-size:11px;line-height:1.55}.ts-cut-box{margin-top:18px;padding:13px;border-radius:12px;background:#f3f7fb;border:1px solid #dce6f0}.ts-cut-box small{display:block;color:#1769df;font-size:8px;font-weight:800;letter-spacing:1px;margin-bottom:5px}.ts-cut-box b{font-size:10px;line-height:1.5}
        @media(max-width:800px){.ts-header{padding:0 16px}.ts-steps{justify-content:flex-start;gap:18px}.ts-home{padding:52px 17px 65px}.ts-hero h1{letter-spacing:-2.7px}.ts-how{margin-top:48px}.ts-collection{margin-top:58px;padding:18px;border-radius:20px}.ts-section-head{display:block}.ts-section-head h2{font-size:26px}.ts-search{width:100%;margin-top:14px}.ts-style-grid{grid-template-columns:repeat(2,1fr)}.ts-style-image{height:180px}.ts-screen{padding:32px 17px 60px}.ts-screen h2{letter-spacing:-2.5px}.ts-camera{height:59vh;min-height:350px}.ts-guide{inset:9% 17%}.ts-analysis-layout{grid-template-columns:1fr;gap:18px}.ts-photo-card{height:300px}.ts-rec{grid-template-columns:145px 1fr}.ts-rec-image{height:230px}.ts-rec-body{padding:16px}.ts-rec-body h3{font-size:22px}.ts-reference-hero{grid-template-columns:1fr}.ts-reference-image{height:430px}.ts-reference-info{padding-top:0}.ts-barber-card{grid-template-columns:130px 1fr}.ts-barber-image{height:180px}}
        @media(max-width:520px){.ts-how{grid-template-columns:1fr;gap:14px}.ts-how-line{display:none}.ts-how-item{display:grid;grid-template-columns:30px 1fr;text-align:left;column-gap:10px;align-items:center}.ts-how-item>span{grid-row:span 2;margin:0}.ts-how-item p{margin:2px 0}.ts-style-grid{grid-template-columns:1fr}.ts-style-image{height:220px}.ts-rec{grid-template-columns:1fr}.ts-rec-image{height:300px}.ts-rec-body{padding:17px}.ts-reference-image{height:390px}.ts-barber-card{grid-template-columns:1fr}.ts-barber-image{height:300px}}
            `}</style>
      <header className="ts-header">
        <button className="ts-brand" onClick={reset} aria-label="Kembali ke TOPSID">
          <span className="ts-brand-mark">T</span>
          <span><b className="ts-brand-name">TOPSID</b><small className="ts-brand-tag">CARI MODEL RAMBUTMU</small></span>
        </button>
        <button className={`ts-menu ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen((value) => !value)} aria-label="Menu">☰</button>
      </header>

      {menuOpen && (
        <div className="ts-menu-popover">
          <button onClick={reset}>Cari model rambut</button>
          <button onClick={goCollection}>TOP'S Collection</button>
        </div>
      )}

      <nav className="ts-steps" aria-label="Perjalanan TOPSID">
        {["Cari", "Foto", "Analisis", "Pilih", "Referensi", "Barber"].map((name, index) => (
          <span key={name} className={`ts-step ${index === stepIndex ? "active" : ""} ${index < stepIndex ? "done" : ""}`}>
            <b>{index < stepIndex ? "✓" : index + 1}</b>{name}
          </span>
        ))}
      </nav>

      {step === "home" && (
        <section className="ts-home">
          <div className="ts-hero">
            <span className="ts-kicker">TOPSID</span>
            <h1>Cari <em>model rambutmu.</em></h1>
            <p>Upload foto kamu. TOPSID membaca karakter rambutmu dan mencarikan model yang paling cocok sebelum kamu potong.</p>
            <button className="ts-cta" onClick={openCapture}>Cari Tahu Sekarang <span>→</span></button>
            <small className="ts-note">Coba gratis • Tanpa daftar</small>
          </div>

          <div className="ts-how">
            <div className="ts-how-line" />
            {[{ n: "01", title: "Foto", text: "Kamera atau galeri." }, { n: "02", title: "Analisis", text: "AI membaca karakter rambut." }, { n: "03", title: "Pilih", text: "Dapatkan 3 model terbaik." }].map((item) => (
              <article key={item.n} className="ts-how-item">
                <span>{item.n}</span><b>{item.title}</b><p>{item.text}</p>
              </article>
            ))}
          </div>

          <section id="collection" className="ts-collection">
            <div className="ts-section-head">
              <div><span className="ts-kicker">TOP'S COLLECTION</span><h2>Referensi model rambut.</h2><p>Jelajahi model yang bisa dicocokkan TOPSID.</p></div>
              <input className="ts-search" placeholder="Cari model..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="ts-filters">
              {categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
            </div>
            <div className="ts-style-grid">
              {filtered.map((item) => (
                <article className="ts-style" key={item.id}>
                  <div className="ts-style-image"><ReferenceImage style={item} /></div>
                  <div className="ts-style-body"><span className="ts-pill">{item.category}</span><h3>{item.name}</h3><p>{item.description}</p><button onClick={() => { setSelected(item); setStep("preview"); }}>Lihat referensi <span>→</span></button></div>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}

      {step === "capture" && (
        <section className="ts-screen ts-capture-screen">
          <button className="ts-back" onClick={() => { stopCamera(); setStep("home"); }}>← Kembali</button>
          <span className="ts-kicker">STEP 01 • FOTO</span>
          <h2>Kasih TOPSID<br /><em>gambaran rambutmu.</em></h2>
          <p className="ts-sub">Hadap depan dan pastikan rambut terlihat jelas. Satu foto sudah cukup untuk mulai.</p>
          <div className="ts-camera">
            {cameraReady ? <video ref={videoRef} autoPlay playsInline muted /> : <div className="ts-camera-fallback"><strong>{error ? "Kamera belum aktif" : "Siap ambil foto?"}</strong><span>{error || "Aktifkan kamera lalu posisikan kepala di dalam panduan."}</span>{!cameraReady && <button className="ts-secondary" onClick={openCapture}>Aktifkan Kamera</button>}</div>}
            {cameraReady && <><div className="ts-guide" /><div className="ts-camera-hint">Rambut & wajah masuk frame</div></>}
          </div>
          {error && <div className="ts-error">{error}</div>}
          <div className="ts-capture-row"><span className="ts-timer">{recording ? `00:${String(seconds).padStart(2, "0")}` : "Foto"}</span><button className={`ts-record ${recording ? "active" : ""}`} onClick={toggleRecording} disabled={!cameraReady} aria-label="Ambil foto"><i /></button><span className="ts-timer" /></div>
          <p className="ts-capture-note">{recording ? "Tunggu sebentar… TOPSID mengambil foto." : "Tekan tombol untuk mengambil foto."}</p>
          <button className="ts-gallery" onClick={() => fileInputRef.current?.click()}>Pilih foto dari galeri <span>→</span></button>
          <input ref={fileInputRef} className="ts-hidden-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => chooseFile(e.target.files?.[0])} />
        </section>
      )}

      {step === "analysis" && (
        <section className="ts-screen ts-analysis">
          <span className="ts-kicker">STEP 02 • ANALISIS AI</span>
          <h2>TOPSID sedang<br /><em>membaca rambutmu.</em></h2>
          <div className="ts-analysis-layout">
            <div className="ts-photo-card">{sourceImage ? <img src={sourceImage} alt="Foto yang dianalisis TOPSID" /> : <div className="ts-photo-empty">Foto kamu</div>}<span>Foto kamu</span></div>
            <div className="ts-analysis-copy"><div className="ts-progress-big"><strong>{progress}%</strong><span>diproses</span></div><div className="ts-progress"><span style={{ width: `${progress}%` }} /></div><p>{stage || "Memulai..."}</p><div className="ts-checks"><div><b>{progress >= 28 ? "✓" : "01"}</b> Membaca karakter rambut</div><div><b>{progress >= 62 ? "✓" : "02"}</b> Mencocokkan TOP'S Collection</div><div><b>{progress >= 100 ? "✓" : "03"}</b> Menyusun 3 pilihan terbaik</div></div></div>
          </div>
          {error && <div className="ts-error">{error}</div>}
        </section>
      )}

      {step === "results" && profile && (
        <section className="ts-screen ts-results">
          <div className="ts-result-intro"><span className="ts-kicker">STEP 03 • HASIL ANALISIS</span><h2>Ini karakter rambutmu,<br /><em>menurut TOPSID.</em></h2><div className="ts-profile">{[["Wajah", profile.face_shape], ["Tipe", profile.hair_type], ["Tekstur", profile.hair_texture], ["Ketebalan", profile.density], ["Panjang", profile.length]].map(([name, value]) => <span key={name}>{name} <b>{label(value)}</b></span>)}<span>Confidence <b>{profile.confidence}%</b></span></div></div>
          <div className="ts-results-title"><span className="ts-kicker">STEP 04 • REKOMENDASI</span><h2>3 model yang<br /><em>paling cocok.</em></h2><p>Jangan cuma lihat nama. Lihat referensinya, bandingkan, lalu bawa pilihanmu ke barber.</p></div>
          <div className="ts-recs">
            {recommendations.map((item, index) => (
              <article className={`ts-rec ${index === 0 ? "first" : ""}`} key={item.id}>
                <div className="ts-rec-image"><ReferenceImage style={item} /><span className="ts-rank">#{index + 1}</span><span className="ts-score">{item.score}% cocok</span></div>
                <div className="ts-rec-body"><span className="ts-pill">{item.category}</span><h3>{item.name}</h3><p>{item.description}</p><div className="ts-reasons">{item.reasons.slice(0, 2).map((reason) => <span key={reason}>✓ {reason}</span>)}</div><button onClick={() => { setSelected(item); setStep("preview"); }}>Lihat referensi model <span>→</span></button></div>
              </article>
            ))}
          </div>
          <button className="ts-secondary ts-full" onClick={() => { setStep("capture"); setError(""); }}>Ulangi dengan foto lain</button>
        </section>
      )}

      {step === "preview" && selected && (
        <section className="ts-screen ts-preview">
          <button className="ts-back" onClick={() => setStep(recommendations.length ? "results" : "home")}>← Kembali</button>
          <span className="ts-kicker">STEP 05 • REFERENSI</span>
          <h2>Ini referensi<br /><em>{selected.name}.</em></h2>
          <div className="ts-reference-hero"><div className="ts-reference-image"><ReferenceImage style={selected} large /><span className="ts-reference-badge">{selected.score ? `${selected.score}% cocok` : "TOP'S Collection"}</span></div><div className="ts-reference-info"><span className="ts-pill">{selected.category}</span><h3>{selected.name}</h3><p>{selected.description}</p><div className="ts-reference-meta"><div><small>Cara potong</small><b>{selected.cut}</b></div>{selected.reasons.length > 0 && <div><small>Kenapa cocok</small><b>{selected.reasons.join(" • ")}</b></div>}</div></div></div>
          <div className="ts-reference-note"><b>Tip untuk barber</b><span>Tunjukkan foto referensi ini lalu jelaskan bagian yang paling penting: panjang atas, sisi, dan finishing yang kamu mau.</span></div>
          <div className="ts-actions"><button className="ts-primary" onClick={() => setStep("barber")}>Siapkan untuk Barber →</button><button className="ts-secondary" onClick={() => setStep("results")}>Bandingkan model lain</button></div>
        </section>
      )}

      {step === "barber" && selected && (
        <section className="ts-screen ts-barber">
          <button className="ts-back" onClick={() => setStep("preview")}>← Kembali</button>
          <span className="ts-kicker">STEP 06 • BARBER</span>
          <h2>Bawa referensi ini<br /><em>ke barber.</em></h2>
          <div className="ts-barber-card"><div className="ts-barber-image"><ReferenceImage style={selected} large /></div><div><span className="ts-pill">MODEL</span><h3>{selected.name}</h3><p>{selected.description}</p><div className="ts-cut-box"><small>CATATAN POTONGAN</small><b>{selected.cut}</b></div></div></div>
          <button className="ts-primary ts-full" onClick={() => navigator.clipboard?.writeText(`TOPSID — ${selected.name}\n${selected.cut}\n${selected.description}`)}>Salin detail untuk barber</button>
          <button className="ts-secondary ts-full" onClick={reset}>Cari model lain</button>
        </section>
      )}
    </main>
  );
}

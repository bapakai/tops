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
};

type Profile = {
  face_shape: string;
  hair_type: string;
  hair_texture: string;
  density: string;
  length: string;
  confidence: number;
};

const FALLBACK_STYLES: Style[] = [
  { id: "two-block", name: "Two Block", score: 0, category: "Modern", description: "Bagian atas medium, sisi lebih ringan.", cut: "Samping low taper • atas 5–7 cm", reasons: [] },
  { id: "low-fade", name: "Low Fade", score: 0, category: "Clean", description: "Fade rendah yang aman untuk daily.", cut: "Samping low fade • atas natural", reasons: [] },
  { id: "textured-crop", name: "Textured Crop", score: 0, category: "Casual", description: "Pendek, bertekstur, mudah ditata.", cut: "Samping crop fade • atas textured", reasons: [] },
  { id: "comma-hair", name: "Comma Hair", score: 0, category: "Korean", description: "Fringe melengkung dengan volume ringan.", cut: "Samping taper • fringe medium", reasons: [] },
  { id: "french-crop", name: "French Crop", score: 0, category: "Short", description: "Rapi, praktis, dan minim styling.", cut: "Samping fade • fringe pendek", reasons: [] },
  { id: "middle-part", name: "Middle Part", score: 0, category: "Medium", description: "Natural dengan belahan tengah.", cut: "Samping taper • atas 8–10 cm", reasons: [] },
];

function toStyle(item: any): Style {
  return {
    id: String(item?.id ?? "style"),
    name: String(item?.name ?? "Model Rambut"),
    score: Number(item?.score ?? 0),
    category: String(item?.category ?? "Classic"),
    description: String(item?.description ?? "Model pilihan TOP'S Collection."),
    cut: String(item?.barber_note ?? item?.cut ?? "Tanyakan detail kepada barber."),
    reasons: Array.isArray(item?.reasons) ? item.reasons.map(String) : [],
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

export default function Topsid() {
  const [step, setStep] = useState<Step>("home");
  const [styles, setStyles] = useState<Style[]>(FALLBACK_STYLES);
  const [recommendations, setRecommendations] = useState<Style[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selected, setSelected] = useState<Style | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const captureTimerRef = useRef<number | null>(null);

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

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Kamera tidak tersedia di browser ini. Gunakan Pilih Foto.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1080 },
          height: { ideal: 1440 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setCameraReady(true);

      window.setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 50);
    } catch {
      setError("Izin kamera belum aktif. Pilih foto dari galeri untuk lanjut.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }

  async function analyze(image: string) {
    setStep("analysis");
    setProgress(12);
    setStage("Menyiapkan analisis AI...");
    setError("");

    try {
      const prepared = await prepareImage(image);

      setProgress(25);
      setStage("Membaca karakter rambut...");

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: prepared }),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || "Analisis AI gagal.");
      }

      const detected = payload.data as Profile;

      setProfile(detected);
      setProgress(58);
      setStage("Mencari model yang paling cocok...");

      const recommendationResponse = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: detected, limit: 3 }),
      });

      const recommendationPayload = await recommendationResponse.json();

      if (!recommendationResponse.ok) {
        throw new Error(
          recommendationPayload?.error || "Rekomendasi belum tersedia."
        );
      }

      const items = Array.isArray(recommendationPayload?.data)
        ? recommendationPayload.data.map(toStyle)
        : [];

      if (!items.length) {
        throw new Error("TOPSID belum menemukan model yang cocok.");
      }

      setRecommendations(items);
      setSelected(items[0]);
      setProgress(100);
      setStage("Selesai");

      window.setTimeout(() => setStep("results"), 300);
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
    analyze(canvas.toDataURL("image/jpeg", 0.82));
  }

  function toggleRecording() {
    if (recording) {
      captureFrame();
      return;
    }

    setRecording(true);
    setSeconds(0);

    timerRef.current = window.setInterval(() => {
      setSeconds((current) => current + 1);
    }, 1000);

    captureTimerRef.current = window.setTimeout(() => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      captureFrame();
    }, 5000);
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
    setProgress(0);
    setStage("");
    setError("");
    setRecording(false);
    setSeconds(0);
  }

  const categories = useMemo(
    () => ["Semua", ...Array.from(new Set(styles.map((item) => item.category)))],
    [styles]
  );

  const filtered = useMemo(
    () =>
      styles.filter(
        (item) =>
          (category === "Semua" || item.category === category) &&
          item.name.toLowerCase().includes(query.toLowerCase())
      ),
    [styles, category, query]
  );

  return (
    <main className="ts-app">
      <style>{`
        .ts-app{min-height:100vh;background:#fffdf9;color:#162f4d;font-family:Manrope,Arial,sans-serif}
        .ts-header{height:72px;border-bottom:1px solid #e8edf3;display:flex;align-items:center;justify-content:space-between;padding:0 22px;background:#fff}
        .ts-brand{display:flex;align-items:center;gap:10px;border:0;background:transparent;color:#162f4d;padding:0;text-align:left}
        .ts-brand-mark{width:42px;height:42px;border-radius:12px;background:#1769df;color:#fff;display:grid;place-items:center;font-weight:800;font-size:21px}
        .ts-brand-name{font-size:18px;font-weight:800;letter-spacing:-.5px}.ts-brand-tag{display:block;color:#1769df;font-size:8px;letter-spacing:1.2px;margin-top:2px}
        .ts-menu{border:0;background:#edf5ff;color:#1769df;width:42px;height:42px;border-radius:12px;font-size:18px}
        .ts-steps{display:flex;justify-content:center;gap:22px;padding:9px 16px;border-bottom:1px solid #edf1f5;overflow:auto;background:#fbfdff}
        .ts-step{font-size:9px;font-weight:800;color:#9aa6b4;white-space:nowrap}.ts-step b{display:inline-grid;place-items:center;width:20px;height:20px;border:1px solid #d6e0eb;border-radius:50%;margin-right:5px;font-size:8px}.ts-step.active{color:#1769df}.ts-step.active b{background:#1769df;color:#fff;border-color:#1769df}
        .ts-home{max-width:1180px;margin:auto;padding:58px 24px 70px}.ts-hero{text-align:center;max-width:760px;margin:0 auto}.ts-kicker{color:#1769df;font-size:10px;font-weight:800;letter-spacing:1.5px}.ts-hero h1{font-size:clamp(42px,8vw,72px);line-height:.98;letter-spacing:-4px;margin:14px 0 20px;font-weight:800}.ts-hero h1 em{font-style:normal;color:#1769df}.ts-hero p{max-width:620px;margin:0 auto;color:#68788c;font-size:15px;line-height:1.7}.ts-cta{margin-top:27px;border:0;background:#1769df;color:#fff;border-radius:14px;padding:17px 24px;font-weight:800;font-size:14px;box-shadow:0 10px 26px rgba(23,105,223,.18)}.ts-note{display:block;color:#8b98a6;font-size:10px;margin-top:10px}
        .ts-journey{max-width:940px;margin:52px auto 0;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.ts-journey-card{border:1px solid #dce6f0;border-radius:18px;padding:22px;background:#fff}.ts-journey-card strong{display:block;font-size:11px;color:#1769df;letter-spacing:1px}.ts-journey-card h3{margin:8px 0 5px;font-size:20px}.ts-journey-card p{margin:0;color:#68788c;font-size:11px;line-height:1.55}.ts-number{width:30px;height:30px;border-radius:9px;background:#edf5ff;color:#1769df;display:grid;place-items:center;font-weight:800;margin-bottom:12px}
        .ts-collection{max-width:940px;margin:26px auto 0;border-radius:20px;background:#f4f8fd;border:1px solid #dce6f0;padding:22px}.ts-collection-top{display:flex;justify-content:space-between;gap:15px;align-items:end}.ts-collection h2{margin:0;font-size:25px;letter-spacing:-1px}.ts-collection p{margin:5px 0 0;color:#68788c;font-size:11px}.ts-search{height:40px;border:1px solid #d7e2ee;border-radius:10px;background:#fff;padding:0 11px;outline:0;width:210px;font-size:11px}.ts-filters{display:flex;gap:6px;overflow:auto;margin:15px 0}.ts-filter{white-space:nowrap;border:1px solid #d7e2ee;background:#fff;color:#68788c;border-radius:18px;padding:7px 11px;font-size:9px}.ts-filter.active{background:#1769df;color:#fff;border-color:#1769df}.ts-style-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.ts-style{background:#fff;border:1px solid #dce6f0;border-radius:14px;padding:15px}.ts-style .pill{color:#1769df;font-size:8px;font-weight:800}.ts-style h3{margin:5px 0;font-size:16px}.ts-style p{margin:0;color:#68788c;line-height:1.5}.ts-style button{margin-top:12px;border:1px solid #c6d8ec;background:#fff;color:#1769df;border-radius:9px;padding:8px 10px;font-size:9px;font-weight:800}
        .ts-screen{max-width:760px;margin:auto;padding:42px 22px 70px}.ts-back{border:0;background:transparent;color:#1769df;font-size:11px;font-weight:800;padding:0;margin-bottom:26px}.ts-screen>label{color:#1769df;font-size:10px;font-weight:800;letter-spacing:1.5px}.ts-screen h2{font-size:clamp(36px,7vw,56px);line-height:1;letter-spacing:-3px;margin:13px 0 15px}.ts-screen h2 em{font-style:normal;color:#1769df}.ts-sub{color:#68788c;line-height:1.6;font-size:13px;max-width:620px}
        .ts-camera{height:min(68vh,600px);min-height:360px;background:#122d4d;border-radius:22px;overflow:hidden;position:relative;margin-top:22px}.ts-camera video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1)}.ts-guide{position:absolute;inset:10% 22%;border:2px solid rgba(255,255,255,.9);border-radius:48%}.ts-camera-fallback{height:100%;display:grid;place-content:center;text-align:center;color:#fff;gap:10px;padding:25px}.ts-camera-fallback strong{font-size:16px}.ts-camera-fallback span{color:#c5d5e7;font-size:11px}.ts-capture-row{display:flex;justify-content:center;align-items:center;gap:24px;margin:20px 0 8px}.ts-record{width:66px;height:66px;border-radius:50%;border:5px solid #e0e9f3;background:#fff;display:grid;place-items:center}.ts-record i{width:48px;height:48px;border-radius:50%;background:#d96e61}.ts-record.active i{border-radius:9px;transform:scale(.62)}.ts-timer{color:#68788c;font-size:10px;width:55px}.ts-gallery{display:block;text-align:center;color:#1769df;font-size:10px;font-weight:800;margin-top:14px;cursor:pointer}.ts-gallery input{display:none}.ts-error{background:#fff2f0;border:1px solid #f0c9c4;color:#9b4035;padding:10px 12px;border-radius:10px;font-size:10px;margin-top:12px}
        .ts-analysis{text-align:center}.ts-scanbox{height:280px;max-width:480px;margin:28px auto 14px;border-radius:20px;background:linear-gradient(135deg,#eef5ff,#f8fbff);border:1px solid #dce6f0;position:relative;overflow:hidden;display:grid;place-items:center}.ts-scan-ring{width:150px;height:190px;border:2px solid #1769df;border-radius:48%;opacity:.8}.ts-scanline{position:absolute;left:12%;right:12%;top:35%;height:2px;background:#1769df;box-shadow:0 0 16px rgba(23,105,223,.6);animation:ts-scan 1.2s infinite alternate}@keyframes ts-scan{to{top:68%}}.ts-percent{position:absolute;right:12px;top:12px;background:#fff;border:1px solid #dce6f0;border-radius:9px;padding:7px 9px;color:#1769df;font-weight:800;font-size:10px}.ts-progress{height:6px;background:#edf1f5;border-radius:10px;overflow:hidden;max-width:480px;margin:auto}.ts-progress span{display:block;height:100%;background:#1769df;transition:width .2s}.ts-stage{font-size:11px;color:#68788c;margin-top:12px}.ts-checks{max-width:480px;margin:20px auto;text-align:left}.ts-check{padding:10px 0;border-bottom:1px solid #edf1f5;font-size:10px}.ts-check b{color:#1769df;margin-right:8px}
        .ts-result-head{margin-bottom:20px}.ts-profile{display:flex;flex-wrap:wrap;gap:7px;margin:16px 0}.ts-chip{background:#edf5ff;color:#68788c;border-radius:9px;padding:7px 9px;font-size:9px}.ts-chip b{color:#162f4d}.ts-recs{display:grid;gap:10px}.ts-rec{display:grid;grid-template-columns:34px 1fr auto;gap:12px;align-items:center;border:1px solid #dce6f0;border-radius:16px;background:#fff;padding:15px}.ts-rec.first{border:2px solid #9fc2ec}.ts-rank{color:#1769df;font-size:13px;font-weight:800;text-align:center}.ts-rec h3{margin:3px 0;font-size:18px}.ts-rec p{margin:0;color:#68788c;font-size:10px;line-height:1.5}.ts-score{color:#1769df;font-size:11px;font-weight:800}.ts-rec button,.ts-outline{border:1px solid #bfd3ee;background:#fff;color:#1769df;border-radius:9px;padding:8px 10px;font-size:9px;font-weight:800}.ts-rec button{margin-top:7px}
        .ts-preview{max-width:820px}.ts-choice{border:1px solid #dce6f0;border-radius:20px;padding:20px;background:#fff}.ts-choice-kicker{color:#1769df;font-size:9px;font-weight:800;letter-spacing:1.2px}.ts-choice h2{font-size:clamp(40px,7vw,64px);margin:8px 0;letter-spacing:-3px}.ts-choice .big-score{font-size:18px;color:#1769df;font-weight:800}.ts-detail{margin-top:18px;padding-top:18px;border-top:1px solid #edf1f5;color:#68788c;font-size:12px;line-height:1.7}.ts-detail b{color:#162f4d}.ts-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}.ts-primary{border:0;background:#1769df;color:#fff;border-radius:10px;padding:11px 15px;font-size:10px;font-weight:800}.ts-secondary{border:1px solid #bfd3ee;background:#fff;color:#1769df;border-radius:10px;padding:11px 15px;font-size:10px;font-weight:800}
        @media(max-width:720px){.ts-header{padding:0 16px}.ts-steps{justify-content:flex-start}.ts-home{padding:42px 18px}.ts-hero h1{letter-spacing:-2.5px}.ts-journey{grid-template-columns:1fr;gap:8px;margin-top:38px}.ts-journey-card{padding:17px}.ts-collection{padding:16px}.ts-collection-top{display:block}.ts-search{width:100%;margin-top:13px}.ts-style-grid{grid-template-columns:1fr}.ts-screen{padding:30px 18px 55px}.ts-camera{height:58vh;min-height:340px}.ts-guide{inset:9% 17%}.ts-rec{grid-template-columns:28px 1fr}.ts-score{display:none}}
      `}</style>

      <header className="ts-header">
        <button className="ts-brand" onClick={reset} aria-label="TOPSID home">
          <span className="ts-brand-mark">T</span>
          <span>
            <span className="ts-brand-name">TOPSID</span>
            <span className="ts-brand-tag">CARI MODEL RAMBUTMU</span>
          </span>
        </button>
        <button className="ts-menu" aria-label="Menu">☰</button>
      </header>

      <nav className="ts-steps" aria-label="Perjalanan TOPSID">
        {["Cari", "Rekam", "Analisis", "Pilih", "Preview", "Barber"].map((name, index) => {
          const active =
            (step === "home" && index === 0) ||
            (step === "capture" && index === 1) ||
            (step === "analysis" && index === 2) ||
            (step === "results" && index === 3) ||
            (step === "preview" && index === 4) ||
            (step === "barber" && index === 5);

          return (
            <span key={name} className={`ts-step ${active ? "active" : ""}`}>
              <b>{index + 1}</b>{name}
            </span>
          );
        })}
      </nav>

      {step === "home" && (
        <section className="ts-home">
          <div className="ts-hero">
            <span className="ts-kicker">TOP'S COLLECTION • AI HAIRSTYLE CHECK</span>
            <h1>Cari model rambutmu,<br /><em>yang paling cocok.</em></h1>
            <p>Rekam sebentar. TOPSID membaca karakter rambutmu, lalu mencarikan model yang paling cocok untukmu.</p>
            <button className="ts-cta" onClick={openCapture}>✦ &nbsp; Cari Tahu Sekarang</button>
            <small className="ts-note">Coba gratis • Tanpa daftar</small>
          </div>

          <div className="ts-journey">
            <article className="ts-journey-card">
              <div className="ts-number">01</div>
              <strong>REKAM</strong>
              <h3>Kasih TOPSID gambaran rambutmu.</h3>
              <p>Gunakan kamera atau pilih foto. Tidak perlu edit atau pindah halaman.</p>
            </article>
            <article className="ts-journey-card">
              <div className="ts-number">02</div>
              <strong>ANALISIS AI</strong>
              <h3>TOPSID membaca karakter rambut.</h3>
              <p>AI membaca bentuk wajah, tipe, tekstur, ketebalan, dan panjang rambut yang terlihat.</p>
            </article>
            <article className="ts-journey-card">
              <div className="ts-number">03</div>
              <strong>REKOMENDASI</strong>
              <h3>Dapatkan 3 model pilihan.</h3>
              <p>Scoring Engine mencocokkan hasil analisis dengan koleksi model rambut TOP'S.</p>
            </article>
          </div>

          <div className="ts-collection">
            <div className="ts-collection-top">
              <div>
                <h2>TOP'S Collection</h2>
                <p>Model yang bisa dipilih dan dicocokkan oleh TOPSID.</p>
              </div>
              <input className="ts-search" placeholder="Cari model..." value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="ts-filters">
              {categories.map((item) => (
                <button key={item} className={`ts-filter ${category === item ? "active" : ""}`} onClick={() => setCategory(item)}>
                  {item}
                </button>
              ))}
            </div>
            <div className="ts-style-grid">
              {filtered.slice(0, 6).map((item) => (
                <article className="ts-style" key={item.id}>
                  <span className="pill">{item.category}</span>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <button onClick={() => { setSelected(item); setStep("preview"); }}>Lihat detail →</button>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {step === "capture" && (
        <section className="ts-screen">
          <button className="ts-back" onClick={() => { stopCamera(); setStep("home"); }}>← Kembali</button>
          <label>STEP 01 • REKAM</label>
          <h2>Rekam rambutmu,<br /><em>sebentar saja.</em></h2>
          <p className="ts-sub">Hadap depan dan posisikan kepala di dalam panduan. TOPSID akan lanjut otomatis setelah rekaman selesai.</p>

          <div className="ts-camera">
            {cameraReady ? (
              <video ref={videoRef} autoPlay playsInline muted />
            ) : (
              <div className="ts-camera-fallback">
                <strong>Kamera belum aktif</strong>
                <span>{error || "Aktifkan kamera untuk mulai."}</span>
                {!error && <button className="ts-secondary" onClick={openCapture}>Aktifkan Kamera</button>}
              </div>
            )}
            <div className="ts-guide" />
          </div>

          {error && <div className="ts-error">{error}</div>}

          <div className="ts-capture-row">
            <span className="ts-timer">00:{String(seconds).padStart(2, "0")}</span>
            <button className={`ts-record ${recording ? "active" : ""}`} onClick={toggleRecording} disabled={!cameraReady} aria-label="Rekam"><i /></button>
            <span className="ts-timer" />
          </div>

          <p style={{ textAlign: "center", color: "#68788c", fontSize: 10 }}>
            {recording ? "Merekam... hadap depan → kiri → kanan" : "Tekan tombol untuk merekam ±5 detik"}
          </p>

          <label className="ts-gallery">
            Atau pilih foto dari galeri
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => chooseFile(e.target.files?.[0])} />
          </label>
        </section>
      )}

      {step === "analysis" && (
        <section className="ts-screen ts-analysis">
          <label>STEP 02 • ANALISIS AI</label>
          <h2>Mengenali rambutmu,<br /><em>lalu mencocokkannya.</em></h2>
          <div className="ts-scanbox">
            <div className="ts-scan-ring" />
            <div className="ts-scanline" />
            <span className="ts-percent">{progress}%</span>
          </div>
          <div className="ts-progress"><span style={{ width: `${progress}%` }} /></div>
          <p className="ts-stage">{stage || "Memulai..."}</p>
          <div className="ts-checks">
            <div className="ts-check"><b>{progress >= 25 ? "✓" : "·"}</b>Membaca karakter rambut</div>
            <div className="ts-check"><b>{progress >= 58 ? "✓" : "·"}</b>Mencocokkan model TOP'S Collection</div>
            <div className="ts-check"><b>{progress >= 100 ? "✓" : "·"}</b>Menyusun 3 rekomendasi terbaik</div>
          </div>
          {error && <div className="ts-error">{error}</div>}
        </section>
      )}

      {step === "results" && profile && (
        <section className="ts-screen">
          <div className="ts-result-head">
            <label>STEP 03 • HASIL ANALISIS</label>
            <h2>Ini karakter rambutmu,<br /><em>menurut TOPSID.</em></h2>
            <div className="ts-profile">
              <span className="ts-chip">Wajah <b>{profile.face_shape}</b></span>
              <span className="ts-chip">Tipe <b>{profile.hair_type}</b></span>
              <span className="ts-chip">Tekstur <b>{profile.hair_texture}</b></span>
              <span className="ts-chip">Ketebalan <b>{profile.density}</b></span>
              <span className="ts-chip">Panjang <b>{profile.length}</b></span>
              <span className="ts-chip">Confidence <b>{profile.confidence}%</b></span>
            </div>
          </div>

          <label>STEP 04 • REKOMENDASI</label>
          <h2>3 model yang<br /><em>paling cocok.</em></h2>

          <div className="ts-recs">
            {recommendations.map((item, index) => (
              <article className={`ts-rec ${index === 0 ? "first" : ""}`} key={item.id}>
                <div className="ts-rank">{index + 1}</div>
                <div>
                  <span className="pill" style={{ color: "#1769df", fontSize: 8, fontWeight: 800 }}>{item.category}</span>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  {item.reasons.slice(0, 2).map((reason) => <p key={reason}>✓ {reason}</p>)}
                  <button onClick={() => { setSelected(item); setStep("preview"); }}>Lihat model →</button>
                </div>
                <span className="ts-score">{item.score}%</span>
              </article>
            ))}
          </div>
        </section>
      )}

      {step === "preview" && selected && (
        <section className="ts-screen ts-preview">
          <button className="ts-back" onClick={() => setStep(recommendations.length ? "results" : "home")}>← Kembali</button>
          <div className="ts-choice">
            <span className="ts-choice-kicker">MODEL PILIHAN</span>
            <h2>{selected.name}</h2>
            <span className="big-score">Cocok {selected.score}%</span>
            <div className="ts-detail">
              <p>{selected.description}</p>
              <p><b>Catatan barber:</b> {selected.cut}</p>
              {selected.reasons.length > 0 && <p><b>Kenapa cocok:</b> {selected.reasons.join(" • ")}</p>}
            </div>
            <div className="ts-actions">
              <button className="ts-primary" onClick={() => setStep("barber")}>Siapkan untuk Barber →</button>
              <button className="ts-secondary" onClick={() => setStep("results")}>Pilih model lain</button>
            </div>
          </div>
        </section>
      )}

      {step === "barber" && selected && (
        <section className="ts-screen">
          <button className="ts-back" onClick={() => setStep("preview")}>← Kembali</button>
          <label>STEP 06 • BARBER</label>
          <h2>Bawa detail ini<br /><em>ke barber.</em></h2>
          <div className="ts-choice">
            <span className="ts-choice-kicker">MODEL</span>
            <h2>{selected.name}</h2>
            <div className="ts-detail">
              <p><b>Catatan potongan:</b><br />{selected.cut}</p>
              <p><b>Deskripsi:</b><br />{selected.description}</p>
            </div>
            <button className="ts-primary" onClick={() => navigator.clipboard?.writeText(`${selected.name}\n${selected.cut}\n${selected.description}`)}>
              Salin Detail untuk Barber
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

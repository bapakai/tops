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

const IDS = [
  "two-block", "low-fade", "textured-crop",
  "comma-hair", "french-crop", "middle-part",
  "crew-cut", "ivy-league", "short-quiff",
];

const REF = Object.fromEntries(IDS.map((id) => [id, `/refs/${id}.jpg`]));

const FALL: Style[] = [
  { id:"two-block", name:"Two Block", score:0, category:"Modern", description:"Bagian atas medium, sisi lebih ringan.", cut:"Atas medium • sisi lebih ringan", reasons:[] },
  { id:"low-fade", name:"Low Fade", score:0, category:"Clean", description:"Fade rendah yang aman untuk daily.", cut:"Low fade • atas natural", reasons:[] },
  { id:"textured-crop", name:"Textured Crop", score:0, category:"Casual", description:"Pendek, bertekstur, mudah ditata.", cut:"Crop fade • atas textured", reasons:[] },
  { id:"comma-hair", name:"Comma Hair", score:0, category:"Korean", description:"Fringe melengkung dengan volume ringan.", cut:"Two block • comma fringe", reasons:[] },
  { id:"french-crop", name:"French Crop", score:0, category:"Short", description:"Rapi, praktis, minim styling.", cut:"Fade • fringe pendek", reasons:[] },
  { id:"middle-part", name:"Middle Part", score:0, category:"Medium", description:"Natural dengan belahan tengah.", cut:"Taper • atas medium", reasons:[] },
  { id:"crew-cut", name:"Crew Cut", score:0, category:"Short", description:"Praktis, clean, mudah dirawat.", cut:"Fade • atas pendek", reasons:[] },
  { id:"ivy-league", name:"Ivy League", score:0, category:"Classic", description:"Klasik dengan volume tetap rapi.", cut:"Taper • atas 5 cm", reasons:[] },
  { id:"short-quiff", name:"Short Quiff", score:0, category:"Classic", description:"Volume ringan di bagian depan.", cut:"Taper • depan bervolume", reasons:[] },
];

function conv(x: any): Style {
  const id = String(x?.id || "style");
  return {
    id,
    name: String(x?.name || "Model Rambut"),
    score: Number(x?.score || 0),
    category: String(x?.category || "Classic"),
    description: String(x?.description || "Model pilihan TOP'S Collection."),
    cut: String(x?.barber_note || x?.cut || "Tanyakan detail kepada barber."),
    reasons: Array.isArray(x?.reasons) ? x.reasons.map(String) : [],
    referenceImage: REF[id] || String(x?.reference_image_url || x?.image_url || ""),
  };
}

const nice = (v: any) =>
  v ? String(v).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

function ImageRef({ style, big = false }: { style: Style; big?: boolean }) {
  const [bad, setBad] = useState(false);
  if (!style.referenceImage || bad) {
    return (
      <div className={`refFallback ${big ? "big" : ""}`}>
        <b>{style.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</b>
        <span>{style.name}</span>
        <small>Referensi TOPSID</small>
      </div>
    );
  }
  return (
    <img
      className={`refImg ${big ? "big" : ""}`}
      src={style.referenceImage}
      alt={`Referensi ${style.name}`}
      onError={() => setBad(true)}
    />
  );
}

export default function Topsid() {
  const [step, setStep] = useState<Step>("home");
  const [styles, setStyles] = useState<Style[]>(FALL);
  const [recs, setRecs] = useState<Style[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selected, setSelected] = useState<Style | null>(null);
  const [photo, setPhoto] = useState("");
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [camera, setCamera] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/hairstyles?limit=30")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (Array.isArray(p?.data) && p.data.length) setStyles(p.data.map(conv));
      })
      .catch(() => {});
    return () => stopCamera();
  }, []);

  function stopCamera() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera(false);
  }

  async function startJourney() {
    setError("");
    setStep("capture");
    setTimeout(() => {
      if (video.current) openCamera();
    }, 50);
  }

  async function openCamera() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error();
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1440 } },
        audio: false,
      });
      stream.current = s;
      setCamera(true);
      setTimeout(() => {
        if (video.current) video.current.srcObject = s;
      }, 50);
    } catch {
      setCamera(false);
      setError("Kamera tidak tersedia. Pilih foto dari galeri untuk lanjut.");
    }
  }

  async function runAnalysis(src: string) {
    setPhoto(src);
    setStep("analysis");
    setProgress(10);
    setStage("Menyiapkan foto...");
    setError("");

    try {
      const optimized = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const max = 1200;
          const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(img.naturalWidth * scale);
          canvas.height = Math.round(img.naturalHeight * scale);
          canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = () => reject(new Error("Foto tidak dapat dibaca."));
        img.src = src;
      });

      setPhoto(optimized);
      setProgress(35);
      setStage("TOPSID sedang membaca karakter rambut...");

      const a = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: optimized }),
      });
      const ap = await a.json();
      if (!a.ok || !ap?.data) throw new Error(ap?.error || "Analisis AI gagal.");

      setProfile(ap.data);
      setProgress(70);
      setStage("Mencari model yang paling cocok...");

      const r = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: ap.data, limit: 3 }),
      });
      const rp = await r.json();
      if (!r.ok) throw new Error(rp?.error || "Rekomendasi belum tersedia.");

      const list = Array.isArray(rp?.data) ? rp.data.map(conv) : [];
      if (!list.length) throw new Error("TOPSID belum menemukan model yang cocok.");

      setRecs(list);
      setSelected(list[0]);
      setProgress(100);
      setStage("Selesai. Ini pilihan TOPSID untukmu.");
      setTimeout(() => setStep("results"), 250);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analisis belum berhasil.");
      setStep("capture");
    }
  }

  function capture() {
    const v = video.current;
    if (!v?.videoWidth) {
      setError("Kamera belum siap. Coba lagi.");
      return;
    }
    const canvas = document.createElement("canvas");
    const max = 1200;
    const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
    stopCamera();
    runAnalysis(canvas.toDataURL("image/jpeg", 0.82));
  }

  function filePick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setError("Gunakan JPG, PNG, atau WebP.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => runAnalysis(String(reader.result || ""));
    reader.readAsDataURL(f);
    e.target.value = "";
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

  const collection = IDS
    .map((id) => styles.find((s) => s.id === id) || FALL.find((s) => s.id === id)!)
    .map(conv);

  const stepNo = step === "home" ? 1 : step === "capture" ? 2 : step === "analysis" ? 3 : step === "results" ? 4 : 5;

  return (
    <main className="top">
      <style>{`
        *{box-sizing:border-box}
        html{scroll-behavior:smooth}
        body{margin:0;background:#fffdf9}
        button{font-family:inherit}
        .top{min-height:100vh;background:#fffdf9;color:#183451;font-family:Manrope,Arial,sans-serif}
        .wrap{width:min(1050px,100%);margin:auto;padding:0 22px}
        .head{height:78px;background:#fff;border-bottom:1px solid #e5eaf0;display:flex;justify-content:space-between;align-items:center;padding:0 22px;position:sticky;top:0;z-index:20}
        .brand{display:flex;align-items:center;gap:10px;border:0;background:none;color:#183451;cursor:pointer;text-align:left}
        .mark{width:46px;height:46px;border-radius:14px;background:#1769df;color:#fff;display:grid;place-items:center;font-weight:900;font-size:21px;flex:none}
        .brand strong{display:block;font-size:21px;line-height:1.05}
        .brand small{display:block;color:#2469b9;font-size:9px;letter-spacing:1.6px;margin-top:4px}
        .actions{display:flex;gap:10px}
        .ico{width:46px;height:46px;border:1px solid #dce4eb;border-radius:50%;background:#fff;color:#183451;font-size:21px;cursor:pointer}
        .journey{background:#fff;border-bottom:1px solid #e5eaf0}
        .steps{width:min(1050px,100%);margin:auto;padding:9px 22px;display:flex;align-items:center}
        .st{display:flex;align-items:center;gap:6px;flex:1;color:#a0abb5;font-size:11px;font-weight:800;min-width:0}
        .dot{width:28px;height:28px;border:1px solid #d6dfe7;border-radius:50%;display:grid;place-items:center;background:#fff;flex:none}
        .on{color:#1769df}.on .dot{background:#1769df;color:#fff;border-color:#1769df}
        .line{height:1px;background:#e0e7ee;flex:1;margin:0 8px}
        .hero{padding:54px 0 45px}
        .eyebrow,.label{font-size:12px;letter-spacing:2px;font-weight:900;color:#246bb9}
        .hero h1{font-size:clamp(52px,8vw,88px);line-height:.96;letter-spacing:-4px;margin:18px 0 22px;max-width:850px}
        .blue{color:#1769df}
        .lead{font-size:20px;line-height:1.45;color:#687786;max-width:650px}
        .primary{background:#1769df;color:#fff;border:0;border-radius:17px;padding:17px 28px;font-weight:800;font-size:18px;cursor:pointer;box-shadow:0 14px 28px #1769df25}
        .note{text-align:center;color:#7d8994;font-size:13px;max-width:410px;margin:10px 0 0}
        .board{margin-top:34px;background:#10243b;border-radius:24px;padding:20px}
        .boardTitle{text-align:center;color:#f0d39b;font:900 28px Georgia,serif;letter-spacing:3px}
        .boardSub{text-align:center;color:#d7b777;font-size:9px;letter-spacing:2px;margin:4px 0 17px}
        .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
        .tile{background:#f5ecd9;border:4px solid #d6b67b;border-radius:9px;padding:5px;cursor:pointer;min-width:0}
        .tile .refImg,.tile .refFallback{aspect-ratio:1/1;height:auto;min-height:0}
        .tileName{text-align:center;color:#172b40;font-size:11px;font-weight:900;margin:5px 0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .section{padding:45px 0}
        .section h2{font-size:42px;line-height:1;letter-spacing:-2px;margin:0 0 20px}
        .how{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .infoCard{background:#fff;border:1px solid #dbe4eb;border-radius:22px;padding:22px;min-height:190px}
        .num{width:38px;height:38px;border-radius:11px;background:#edf5fd;color:#1769df;display:grid;place-items:center;font-weight:900}
        .infoCard h3{font-size:24px;margin:17px 0 8px}
        .infoCard p{color:#71808d;line-height:1.5;margin:0}
        .capture,.analysis,.results,.preview{padding:35px 0 70px}
        .back{border:0;background:none;color:#1769df;font-weight:800;padding:0;margin-bottom:16px;cursor:pointer}
        .pageTitle{font-size:42px;line-height:1;letter-spacing:-2px;margin:8px 0 12px}
        .muted{color:#71808d;line-height:1.5}
        .camera{height:min(620px,70vh);min-height:430px;background:#10243b;border-radius:22px;overflow:hidden;position:relative;margin-top:18px;display:flex;align-items:center;justify-content:center}
        .camera video{width:100%;height:100%;object-fit:cover}
        .overlay{position:absolute;inset:22px;border:1px solid #fff8;border-radius:20px;pointer-events:none}
        .shutter{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);width:74px;height:74px;border:7px solid #fff;border-radius:50%;background:#fff;cursor:pointer}
        .gallery{position:absolute;right:18px;bottom:26px;border:0;border-radius:11px;padding:11px 14px;background:#fff;color:#183451;font-weight:800;cursor:pointer}
        .cameraEmpty{padding:30px;text-align:center;color:#fff}
        .cameraEmpty button{margin-top:15px}
        .error{margin:14px 0;padding:12px;border-radius:11px;background:#fff0f0;border:1px solid #ffd0d0;color:#a13b3b}
        .analysis{text-align:center}
        .analysisPhoto{width:min(100%,430px);margin:20px auto;border-radius:20px;overflow:hidden;border:1px solid #dbe4eb}
        .analysisPhoto img{width:100%;display:block;aspect-ratio:4/5;object-fit:cover}
        .loader{width:70px;height:70px;border:7px solid #e5eef8;border-top-color:#1769df;border-radius:50%;animation:spin 1s linear infinite;margin:20px auto}
        @keyframes spin{to{transform:rotate(360deg)}}
        .progress{height:7px;background:#e7edf3;border-radius:99px;max-width:430px;margin:15px auto;overflow:hidden}
        .progress span{display:block;height:100%;background:#1769df;transition:width .3s}
        .stage{font-weight:800}
        .chips{display:flex;flex-wrap:wrap;gap:9px;margin:18px 0 30px}
        .chip{background:#edf5fd;border-radius:12px;padding:10px 12px;color:#71808d;font-size:13px}
        .chip b{color:#183451}
        .resultsHeader{margin-bottom:24px}
        .recs{display:grid;gap:14px}
        .rec{display:grid;grid-template-columns:112px minmax(0,1fr);gap:16px;background:#fff;border:2px solid #dce5ed;border-radius:20px;padding:12px;min-width:0}
        .rec:first-child{border-color:#a8c9eb}
        .recMedia{width:112px;height:150px;border-radius:14px;overflow:hidden;min-width:0}
        .rec h3{font-size:24px;margin:5px 0 5px;overflow-wrap:anywhere}
        .score{color:#178043;font-weight:900;font-size:14px}
        .reasons{list-style:none;padding:0;margin:7px 0;color:#73808d;font-size:13px;line-height:1.55}
        .reasons li{margin:2px 0}
        .outline{margin-top:8px;border:1px solid #bdd0df;background:#fff;color:#246bb8;border-radius:10px;padding:9px 12px;font-weight:800;cursor:pointer}
        .refImg{width:100%;height:100%;display:block;object-fit:cover}
        .refFallback{background:#edf5fd;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;min-height:150px;padding:10px}
        .refFallback.big{min-height:330px}
        .refFallback b{width:48px;height:48px;border-radius:50%;background:#1769df;color:#fff;display:grid;place-items:center}
        .refFallback small{color:#7f8c99}
        .previewGrid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(300px,.85fr);gap:22px;align-items:start}
        .previewMain{background:#fff;border:1px solid #dbe4eb;border-radius:22px;overflow:hidden}
        .previewImage{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}
        .previewCopy{padding:24px}
        .previewCopy h2{font-size:36px;margin:6px 0 10px}
        .detailBox{background:#f1f6fb;border-radius:16px;padding:16px;margin:18px 0}
        .detailBox strong{display:block;margin-bottom:7px}
        .cta{width:100%;background:#1769df;color:#fff;border:0;border-radius:14px;padding:14px;font-weight:800;font-size:16px;cursor:pointer}
        .sideRef{background:#10243b;border-radius:22px;padding:16px;color:#fff}
        .sideRef h3{margin:4px 0 14px;font-size:22px}
        .sideRef .refFallback,.sideRef .refImg{border-radius:14px}
        .secondary{width:100%;margin-top:10px;border:1px solid #bdd0df;background:#fff;color:#246bb8;border-radius:14px;padding:13px;font-weight:800;cursor:pointer}
        @media(max-width:700px){
          .head{height:72px;padding:0 16px}
          .brand strong{font-size:19px}.brand small{font-size:8px}
          .mark{width:44px;height:44px}
          .actions .ico:first-child{display:none}
          .steps{padding:8px 14px;gap:3px}
          .st{font-size:9px;gap:4px}
          .dot{width:26px;height:26px}
          .line{margin:0 3px}
          .wrap{padding:0 16px}
          .hero{padding:42px 0 32px}
          .hero h1{font-size:48px;letter-spacing:-3px}
          .lead{font-size:18px}
          .primary{width:100%;font-size:17px}
          .note{width:100%}
          .board{margin-top:28px;padding:12px;border-radius:18px}
          .boardTitle{font-size:22px;letter-spacing:2px}
          .boardSub{font-size:8px}
          .grid{gap:7px}
          .tile{border-width:3px;padding:3px}
          .tileName{font-size:8px;margin-top:3px}
          .section{padding:34px 0}
          .section h2{font-size:34px}
          .how{grid-template-columns:1fr}
          .infoCard{min-height:0}
          .capture,.analysis,.results,.preview{padding:26px 0 50px}
          .pageTitle{font-size:34px}
          .camera{height:calc(100svh - 205px);min-height:420px}
          .rec{grid-template-columns:92px minmax(0,1fr);gap:12px;padding:10px}
          .recMedia{width:92px;height:124px}
          .rec h3{font-size:21px;line-height:1.1}
          .reasons{font-size:12px;line-height:1.4}
          .outline{font-size:12px;padding:8px 10px}
          .previewGrid{grid-template-columns:1fr}
          .previewCopy h2{font-size:31px}
        }
      `}</style>

      <header className="head">
        <button className="brand" onClick={reset} aria-label="Kembali ke TOPSID">
          <span className="mark">T</span>
          <span><strong>TOPSID</strong><small>CARI MODEL RAMBUTMU</small></span>
        </button>
        <div className="actions">
          <button className="ico" onClick={reset} aria-label="Mulai ulang">↻</button>
          <button className="ico" onClick={reset} aria-label="Menu">☰</button>
        </div>
      </header>

      {step !== "home" && (
        <nav className="journey" aria-label="Progress">
          <div className="steps">
            {["Cari","Rekam","Analisis","Pilih","Preview"].map((label, i) => (
              <div className={`st ${stepNo >= i + 1 ? "on" : ""}`} key={label}>
                <span className="dot">{i + 1}</span><span>{label}</span>
                {i < 4 && <span className="line" />}
              </div>
            ))}
          </div>
        </nav>
      )}

      {step === "home" && (
        <>
          <section className="hero">
            <div className="wrap">
              <div className="eyebrow">TOPSID</div>
              <h1>Cari model rambutmu,<br /><span className="blue">yang paling cocok.</span></h1>
              <p className="lead">Lihat model rambut yang cocok buat kamu. Cukup rekam sebentar, lalu biarkan TOPSID membantu mencarikannya.</p>
              <button className="primary" onClick={startJourney}>✦ &nbsp; Cari Tahu Sekarang</button>
              <p className="note">Coba gratis · Tanpa daftar</p>

              <div className="board">
                <div className="boardTitle">TOP'S COLLECTION</div>
                <div className="boardSub">9 MODEL POPULER UNTUK MULAI</div>
                <div className="grid">
                  {collection.map((s) => (
                    <button className="tile" key={s.id} onClick={() => { setSelected(s); setStep("preview"); }}>
                      <ImageRef style={s} />
                      <div className="tileName">{s.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="wrap">
              <h2>Gimana cara kerjanya?</h2>
              <div className="how">
                <div className="infoCard"><div className="num">01</div><h3>Rekam</h3><p>Kasih TOPSID gambaran rambutmu lewat kamera atau foto.</p></div>
                <div className="infoCard"><div className="num">02</div><h3>Analisis AI</h3><p>TOPSID membaca bentuk wajah, tipe, tekstur, ketebalan, dan panjang rambut.</p></div>
                <div className="infoCard"><div className="num">03</div><h3>Rekomendasi</h3><p>Dapatkan 3 model dari TOP'S Collection yang paling cocok.</p></div>
              </div>
            </div>
          </section>
        </>
      )}

      {step === "capture" && (
        <section className="capture">
          <div className="wrap">
            <button className="back" onClick={reset}>← Kembali</button>
            <div className="label">STEP 02 · REKAM</div>
            <h1 className="pageTitle">Kasih TOPSID gambaran rambutmu.</h1>
            <p className="muted">Hadap depan dan ambil foto rambutmu. Tidak perlu edit atau pindah halaman.</p>

            {error && <div className="error">{error}</div>}

            <div className="camera">
              {camera ? (
                <>
                  <video ref={video} autoPlay playsInline muted />
                  <div className="overlay" />
                  <button className="shutter" onClick={capture} aria-label="Ambil foto" />
                  <button className="gallery" onClick={() => input.current?.click()}>Galeri</button>
                </>
              ) : (
                <div className="cameraEmpty">
                  <h2>Foto siap?</h2>
                  <p>Pilih foto dari galeri atau aktifkan kamera.</p>
                  <button className="primary" onClick={openCamera}>Buka Kamera</button>
                  <br />
                  <button className="secondary" onClick={() => input.current?.click()}>Pilih dari Galeri</button>
                </div>
              )}
            </div>
            <input ref={input} type="file" accept="image/*" capture="user" hidden onChange={filePick} />
          </div>
        </section>
      )}

      {step === "analysis" && (
        <section className="analysis">
          <div className="wrap">
            <div className="label">STEP 03 · ANALISIS</div>
            <h1 className="pageTitle">TOPSID sedang membaca rambutmu.</h1>
            {photo && <div className="analysisPhoto"><img src={photo} alt="Foto yang dianalisis TOPSID" /></div>}
            <div className="loader" />
            <div className="stage">{stage}</div>
            <div className="progress"><span style={{ width: `${progress}%` }} /></div>
          </div>
        </section>
      )}

      {step === "results" && profile && (
        <section className="results">
          <div className="wrap">
            <div className="label">STEP 03 · HASIL ANALISIS</div>
            <h1 className="pageTitle">Ini karakter rambutmu,<br /><span className="blue">menurut TOPSID.</span></h1>

            <div className="chips">
              <span className="chip">Wajah <b>{nice(profile.face_shape)}</b></span>
              <span className="chip">Tipe <b>{nice(profile.hair_type)}</b></span>
              <span className="chip">Tekstur <b>{nice(profile.hair_texture)}</b></span>
              <span className="chip">Ketebalan <b>{nice(profile.density)}</b></span>
              <span className="chip">Panjang <b>{nice(profile.length)}</b></span>
              <span className="chip">Confidence <b>{profile.confidence}%</b></span>
            </div>

            <div className="resultsHeader">
              <div className="label">STEP 04 · REKOMENDASI</div>
              <h2 className="pageTitle">3 model yang<br /><span className="blue">paling cocok.</span></h2>
            </div>

            <div className="recs">
              {recs.map((s, i) => (
                <article className="rec" key={s.id}>
                  <div className="recMedia"><ImageRef style={s} /></div>
                  <div>
                    <div className="label">{String(i + 1).padStart(2, "0")} · {s.category}</div>
                    <h3>{s.name}</h3>
                    <div className="score">{s.score}% cocok</div>
                    <ul className="reasons">
                      {(s.reasons.length ? s.reasons : [s.description]).slice(0, 3).map((r, n) => <li key={n}>✓ {r}</li>)}
                    </ul>
                    <button className="outline" onClick={() => { setSelected(s); setStep("preview"); }}>Lihat model →</button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {step === "preview" && selected && (
        <section className="preview">
          <div className="wrap">
            <button className="back" onClick={() => setStep(recs.length ? "results" : "home")}>← Kembali</button>
            <div className="label">STEP 05 · PREVIEW</div>
            <h1 className="pageTitle">Ini referensi<br /><span className="blue">{selected.name}.</span></h1>

            <div className="previewGrid">
              <div className="previewMain">
                <ImageRef style={selected} big />
                <div className="previewCopy">
                  <div className="label">{selected.category}</div>
                  <h2>{selected.name}</h2>
                  <p className="muted">{selected.description}</p>
                  <div className="detailBox">
                    <strong>Catatan potongan untuk barber</strong>
                    <span>{selected.cut}</span>
                  </div>
                  <button className="cta" onClick={() => setStep("results")}>Tunjukkan ke barber →</button>
                </div>
              </div>

              <aside className="sideRef">
                <h3>Referensi TOPSID</h3>
                <ImageRef style={selected} />
                <p>Gunakan foto ini sebagai referensi utama saat menjelaskan model ke barber.</p>
                <button className="secondary" onClick={() => setStep("results")}>Pilih model lain</button>
              </aside>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Step = "home" | "camera" | "analysis" | "results" | "collection" | "preview" | "barber";
type Style = {
  id: string;
  name: string;
  score: number;
  category: string;
  description: string;
  cut: string;
};

const styles: Style[] = [
  { id: "two-block", name: "Two Block", score: 94, category: "Modern", description: "Bagian atas medium, sisi lebih ringan.", cut: "Samping low taper • atas 5–7 cm" },
  { id: "low-fade", name: "Low Fade", score: 91, category: "Clean", description: "Fade rendah yang aman untuk daily.", cut: "Samping low fade • atas natural" },
  { id: "textured-crop", name: "Textured Crop", score: 88, category: "Casual", description: "Pendek, bertekstur, mudah ditata.", cut: "Samping crop fade • atas textured" },
  { id: "comma-hair", name: "Comma Hair", score: 86, category: "Korean", description: "Fringe melengkung dengan volume ringan.", cut: "Samping taper • fringe medium" },
  { id: "french-crop", name: "French Crop", score: 84, category: "Short", description: "Rapi, praktis, dan minim styling.", cut: "Samping fade • fringe pendek" },
  { id: "middle-part", name: "Middle Part", score: 82, category: "Medium", description: "Natural dengan belahan tengah.", cut: "Samping taper • atas 8–10 cm" },
  { id: "crew-cut", name: "Crew Cut", score: 80, category: "Short", description: "Praktis, clean, dan mudah dirawat.", cut: "Samping fade • atas pendek" },
  { id: "ivy-league", name: "Ivy League", score: 79, category: "Classic", description: "Klasik dengan volume yang tetap rapi.", cut: "Samping taper • atas 5 cm" },
  { id: "short-quiff", name: "Short Quiff", score: 77, category: "Classic", description: "Volume ringan di depan.", cut: "Samping taper • depan bervolume" },
  { id: "buzz-cut", name: "Buzz Cut", score: 75, category: "Short", description: "Super ringkas dan praktis.", cut: "Clipper pendek merata" },
  { id: "side-part", name: "Side Part", score: 74, category: "Classic", description: "Rapi dengan belahan samping.", cut: "Taper • side part natural" },
  { id: "slick-back", name: "Slick Back", score: 72, category: "Classic", description: "Clean dengan rambut diarahkan ke belakang.", cut: "Taper • atas medium panjang" },
  { id: "pompadour", name: "Pompadour", score: 70, category: "Classic", description: "Volume lebih tinggi dan statement.", cut: "Taper • volume atas tinggi" },
  { id: "curtain-hair", name: "Curtain Hair", score: 69, category: "Medium", description: "Natural dengan belahan tengah.", cut: "Layer medium • fringe panjang" },
  { id: "wolf-cut", name: "Wolf Cut", score: 67, category: "Modern", description: "Layered dan lebih berkarakter.", cut: "Layer medium • tekstur natural" },
  { id: "mullet", name: "Mullet", score: 65, category: "Modern", description: "Lebih pendek di depan, panjang di belakang.", cut: "Taper • belakang dipanjangkan" },
  { id: "curly-top", name: "Curly Top", score: 64, category: "Curly", description: "Mempertahankan tekstur ikal alami.", cut: "Samping taper • atas natural" },
  { id: "spiky-hair", name: "Spiky Hair", score: 62, category: "Casual", description: "Tekstur berdiri dengan karakter playful.", cut: "Samping pendek • atas textured" },
  { id: "undercut", name: "Undercut", score: 60, category: "Modern", description: "Kontras sisi dan bagian atas.", cut: "Samping undercut • atas panjang" },
  { id: "taper-fade", name: "Taper Fade", score: 59, category: "Clean", description: "Gradasi halus dan versatile.", cut: "Taper di pelipis dan tengkuk" },
  { id: "drop-fade", name: "Drop Fade", score: 57, category: "Clean", description: "Fade mengikuti kontur kepala.", cut: "Drop fade • atas natural" },
  { id: "crop-fade", name: "Crop Fade", score: 55, category: "Short", description: "Crop ringkas dengan fade.", cut: "Crop pendek • fade samping" },
  { id: "comb-over", name: "Comb Over", score: 53, category: "Classic", description: "Rapi dan mudah dibawa formal.", cut: "Taper • belahan natural" },
  { id: "messy-hair", name: "Messy Hair", score: 51, category: "Casual", description: "Natural, santai, dan effortless.", cut: "Layer medium • textured" },
  { id: "high-fade", name: "High Fade", score: 49, category: "Clean", description: "Kontras lebih kuat dan sporty.", cut: "High fade • atas medium" },
  { id: "caesar-cut", name: "Caesar Cut", score: 47, category: "Short", description: "Fringe pendek dengan bentuk tegas.", cut: "Fade • fringe pendek" },
  { id: "textured-quiff", name: "Textured Quiff", score: 45, category: "Modern", description: "Quiff ringan dengan tekstur natural.", cut: "Taper • atas textured" },
  { id: "brush-up", name: "Brush Up", score: 43, category: "Casual", description: "Rambut diarahkan ke atas dengan volume.", cut: "Taper • top medium" },
  { id: "long-layer", name: "Long Layer", score: 41, category: "Long", description: "Layer panjang dengan jatuh natural.", cut: "Layer panjang • ujung natural" },
  { id: "shag", name: "Shag", score: 39, category: "Modern", description: "Layer ringan dengan karakter messy.", cut: "Layer • fringe medium" }
];

const topNine = styles.slice(0, 9);
const recommendations = styles.slice(0, 3);

export default function Topsid() {
  const [step, setStep] = useState<Step>("home");
  const [photo, setPhoto] = useState<string | null>(null);
  const [selected, setSelected] = useState<Style>(recommendations[0]);
  const [hasChecked, setHasChecked] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState(0);
  const [cameraError, setCameraError] = useState("");
  const [filter, setFilter] = useState("Semua");
  const [query, setQuery] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  async function openCamera() {
    setStep("camera");
    setCameraError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Browser ini belum mendukung kamera. Kamu bisa pilih foto dari galeri.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1440 } },
        audio: false
      });
      streamRef.current = stream;
      setCameraOn(true);
      window.setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 50);
    } catch {
      setCameraOn(false);
      setCameraError("Kamera belum mendapat izin. Aktifkan izin kamera atau pilih foto dari galeri.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  function startAnalysis() {
    setStep("analysis");
    setProgress(0);
    let value = 0;

    const interval = window.setInterval(() => {
      value += 10;
      setProgress(value);

      if (value >= 100) {
        window.clearInterval(interval);
        window.setTimeout(() => {
          setHasChecked(true);
          setStep("results");
        }, 350);
      }
    }, 140);
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.88));
    stopCamera();
    setRecording(false);
    startAnalysis();
  }

  function toggleRecording() {
    if (recording) {
      captureFrame();
      return;
    }

    setRecording(true);
    setSeconds(0);

    timerRef.current = window.setInterval(() => {
      setSeconds((current) => {
        if (current >= 4) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          window.setTimeout(captureFrame, 100);
          return 5;
        }
        return current + 1;
      });
    }, 1000);
  }

  function handleGallery(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result));
      startAnalysis();
    };
    reader.readAsDataURL(file);
  }

  function selectStyle(style: Style) {
    setSelected(style);
    setStep("preview");
  }

  function reset() {
    stopCamera();
    if (timerRef.current) window.clearInterval(timerRef.current);
    setPhoto(null);
    setSelected(recommendations[0]);
    setHasChecked(false);
    setRecording(false);
    setSeconds(0);
    setProgress(0);
    setCameraError("");
    setFilter("Semua");
    setQuery("");
    setStep("home");
  }

  const filteredStyles = useMemo(() => {
    return styles.filter((style) => {
      const matchesFilter = filter === "Semua" || style.category === filter;
      const matchesQuery = style.name.toLowerCase().includes(query.toLowerCase());
      return matchesFilter && matchesQuery;
    });
  }, [filter, query]);

  return (
    <main className="site">
      <header>
        <button className="logo" onClick={reset} aria-label="TOPSID home">
          <span>T</span>
          <b>TOPSID<small>CARI MODEL RAMBUTMU</small></b>
        </button>
        <button className="menu" type="button" aria-label="Menu">☰</button>
      </header>

      <div className="journey">
        {["Cari", "Rekam", "Analisis", "Pilih", "Preview", "Barber"].map((item, index) => (
          <span key={item}><i>{index + 1}</i>{item}</span>
        ))}
      </div>

      {step === "home" && (
        <section className="home">
          <div className="hero-copy"><div className="hero-icon" aria-hidden="true">✂</div>
            <label>TOP&apos;S COLLECTION • AI HAIRSTYLE CHECK</label>
            <h1>Cari model rambutmu,<em> yang paling cocok.</em></h1>
            <p>Lihat model rambut yang cocok buat kamu. Cukup rekam sebentar, lalu biarkan TOPSID membantu mencarikannya.</p>
            <button className="cta" onClick={openCamera}>✦ &nbsp; Cari Tahu Sekarang</button>
            <small>Coba gratis • Tanpa daftar</small>
          </div>

          <div className="poster">
            <div className="poster-title">top&apos;s <span>collection</span></div>
            <div className="poster-rule" />
            <div className="poster-grid">
              {topNine.map((style, index) => (
                <button
                  className={`poster-card tilt-${index % 3}`}
                  key={style.id}
                  onClick={() => selectStyle(style)}
                  aria-label={`Lihat ${style.name}`}
                >
                  <span className={`portrait h${(index % 6) + 1}`} aria-hidden="true"><i /></span>
                  <small>{style.name}</small>
                </button>
              ))}
            </div>
            <footer>9 GAYA PILIHAN</footer>
          </div>

          {hasChecked && (
            <div className="for-you">
              <div>
                <label>TOP&apos;S FOR YOU</label>
                <h2>3 gaya yang paling cocok buatmu.</h2>
                <p>Model yang paling cocok dari hasil cek terakhir kamu.</p>
              </div>
              <button onClick={() => setStep("results")}>Lihat rekomendasi →</button>
            </div>
          )}
        </section>
      )}

      {step === "camera" && (
        <section className="screen camera-screen">
          <button className="back" onClick={() => { stopCamera(); setStep("home"); }}>← Kembali</button>
          <label>STEP 01 • REKAM</label>
          <h2>Rekam wajahmu <em>sebentar saja.</em></h2>
          <p className="sub">Hadap depan, lalu sedikit ke kiri dan kanan. TOPSID akan mencari model yang paling cocok.</p>

          <div className="camera">
            {cameraOn ? (
              <video ref={videoRef} autoPlay playsInline muted />
            ) : (
              <div className="fallback">
                <span>👨🏻</span>
                <b>{cameraError ? "Kamera belum siap" : "Kamera belum aktif"}</b>
                <small>{cameraError || "Izinkan akses kamera untuk mulai."}</small>
                <button onClick={openCamera}>Aktifkan Kamera</button>
              </div>
            )}
            <div className="guide" />
            {cameraOn && <span className="camera-hint">Wajah di dalam garis • cahaya cukup</span>}
          </div>

          <div className="controls">
            <small>00:{String(seconds).padStart(2, "0")}</small>
            <button className={recording ? "rec active" : "rec"} onClick={toggleRecording} aria-label="Mulai atau hentikan rekaman"><i /></button>
            <small>↻</small>
          </div>
          <p className="hint">{recording ? "Hadap depan → kiri → kanan" : "Tekan tombol untuk merekam ±5 detik"}</p>

          {!cameraOn && (
            <label className="gallery">
              Atau pilih foto dari galeri
              <input type="file" accept="image/*" onChange={(e) => handleGallery(e.target.files?.[0])} />
            </label>
          )}
        </section>
      )}

      {step === "analysis" && (
        <section className="screen center">
          <label>STEP 02 • ANALISIS AI</label>
          <h2>Sebentar, TOPSID lagi<br /><em>mencari model buatmu.</em></h2>
          <div className="analysis">
            <div>
              {photo ? <img src={photo} alt="Foto pengguna" /> : <span>👨🏻</span>}
              <b>{progress}%</b>
              <div className="scan" />
            </div>
            <div className="analysis-progress"><span style={{ width: `${progress}%` }} /></div>
            {["Bentuk wajah", "Tekstur rambut", "Ketebalan rambut", "Garis rambut", "Proporsi wajah"].map((item, index) => (
              <p key={item}><i>{progress > index * 20 ? "✓" : "·"}</i>{item}<small>{progress > index * 20 ? "Selesai" : "Menganalisis"}</small></p>
            ))}
          </div>
          <aside>🔒 Foto hanya digunakan untuk analisis.</aside>
        </section>
      )}

      {step === "results" && (
        <section className="screen">
          <button className="back" onClick={() => setStep("home")}>← Home</button>
          <label>STEP 03 • TOP&apos;S FOR YOU</label>
          <h2>Ini 3 model yang paling cocok <em>buatmu.</em></h2>
          <div className="profile">
            <span>Wajah <b>Oval</b></span>
            <span>Rambut <b>Lurus</b></span>
            <span>Ketebalan <b>Sedang</b></span>
          </div>

          <div className="list">
            {recommendations.map((style, index) => (
              <article className={index === 0 ? "recommended" : ""} key={style.id}>
                <b className="rank">{index + 1}</b>
                <div className="stylepic">{photo ? <img src={photo} alt="" /> : <span>{["✦", "◒", "✂"][index]}</span>}</div>
                <div>
                  <small>{style.category}</small>
                  <h3>{style.name}</h3>
                  <p>{style.description}</p>
                  <strong>Cocok {style.score}%</strong>
                </div>
                <button onClick={() => selectStyle(style)}>Coba di wajahku →</button>
              </article>
            ))}
          </div>

          <div className="collection-note">
            <div><b>Masih bingung pilih yang mana?</b><span>Jelajahi lebih banyak model dan temukan yang paling kamu suka.</span></div>
            <button onClick={() => setStep("collection")}>Jelajahi Collection →</button>
          </div>
        </section>
      )}

      {step === "collection" && (
        <section className="screen">
          <button className="back" onClick={() => setStep("results")}>← TOP&apos;S For You</button>
          <label>TOP&apos;S COLLECTION</label>
          <h2>Masih cari inspirasi?<br /><em>Pilih model yang kamu suka.</em></h2>

          <div className="collection-search">
            <span>⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari model rambut..." />
          </div>

          <div className="filters">
            {["Semua", "Short", "Clean", "Modern", "Classic", "Medium"].map((item) => (
              <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>
            ))}
          </div>

          <div className="grid">
            {filteredStyles.map((style, index) => (
              <button key={style.id} onClick={() => selectStyle(style)}>
                <span>{["◉", "◒", "◐", "◓"][index % 4]}</span>
                <b>{style.name}</b>
                <small>{style.category}</small>
              </button>
            ))}
          </div>

          {filteredStyles.length === 0 && <div className="empty">Model yang kamu cari belum ada.</div>}
        </section>
      )}

      {step === "preview" && (
        <section className="screen">
          <button className="back" onClick={() => setStep("results")}>← Rekomendasi</button>
          <label>STEP 04 • PREVIEW</label>
          <h2><em>{selected.name}</em><br />di wajahmu.</h2>

          <div className="preview">
            {photo ? <img src={photo} alt={`Preview ${selected.name}`} /> : <span>👨🏻</span>}
            <b>PREVIEW DEMO</b>
            <div className="preview-style">STYLE: {selected.name.toUpperCase()}</div>
          </div>

          <div className="angles"><button className="active">Depan</button><button>Samping</button><button>45°</button></div>

          <div className="summary">
            <span>KECOCOKAN<strong>{selected.score}%</strong></span>
            <span>GAYA<strong>{selected.name}</strong></span>
            <span>PERAWATAN<strong>Easy</strong></span>
          </div>

          <div className="cut-note"><small>BRIEF UNTUK BARBER</small><b>{selected.cut}</b></div>

          <button className="cta wide" onClick={() => setStep("barber")}>✂ Tunjukkan ke Barber</button>
          <button className="ghost" onClick={() => setStep("collection")}>Coba gaya lain</button>
          <small className="demo">Preview AI asli akan mengganti foto ini setelah image generation terhubung.</small>
        </section>
      )}

      {step === "barber" && (
        <section className="screen">
          <button className="back" onClick={() => setStep("preview")}>← Preview</button>
          <label>STEP 05 • BARBER CARD</label>
          <h2>Sudah tahu mau model apa.<br /><em>Tinggal tunjukkan.</em></h2>

          <div className="barber">
            <header>
              <div><small>TOPSID RECOMMENDS</small><h3>{selected.name}</h3><b>Cocok {selected.score}%</b></div>
              <strong>TOPSID</strong>
            </header>
            <div className="barberpic">{photo ? <img src={photo} alt="" /> : <span>👨🏻</span>}</div>
            <div className="specs">
              <span>SAMPING<b>{selected.cut.split(" • ")[0]}</b></span>
              <span>ATAS<b>{selected.cut.split(" • ")[1] || "Natural"}</b></span>
              <span>STYLING<b>Matte / natural</b></span>
            </div>
            <p>“Mas, saya mau model seperti ini. Bagian samping dibuat ringan, atas tetap natural.”</p>
          </div>

          <div className="actions">
            <button className="cta" onClick={() => alert("Demo: Barber Card siap dibagikan.")}>↗ Bagikan</button>
            <button className="ghost" onClick={reset}>Selesai</button>
          </div>
        </section>
      )}

      <footer className="foot"><b>TOPSID</b><span>Cari Model Rambutmu</span><span>© 2026</span></footer>
    </main>
  );
}

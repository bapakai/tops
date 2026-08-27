"use client";

import { ChangeEvent, useMemo, useState } from "react";

type Step = "home" | "upload" | "analysis" | "recommendation" | "preview";

const styles = [
  {
    name: "Textured Crop",
    sub: "Low Fade",
    score: 94,
    emoji: "✂️",
    description: "Potongan pendek dengan tekstur di bagian atas dan gradasi rendah di samping.",
  },
  {
    name: "Two Block",
    sub: "Korean Style",
    score: 89,
    emoji: "🧑🏻‍🎤",
    description: "Bagian atas lebih panjang dengan sisi yang ringan. Cocok untuk tampilan clean dan modern.",
  },
  {
    name: "Short Quiff",
    sub: "Mid Fade",
    score: 83,
    emoji: "💈",
    description: "Volume ringan di bagian depan dengan fade yang membuat wajah terlihat lebih tegas.",
  },
];

export default function PotramApp() {
  const [step, setStep] = useState<Step>("home");
  const [photo, setPhoto] = useState<string | null>(null);
  const [selected, setSelected] = useState(styles[0]);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const headline = useMemo(() => {
    if (step === "home") return "Mau potong rambut tapi takut nggak cocok?";
    if (step === "upload") return "Upload fotomu";
    if (step === "analysis") return "Menganalisis...";
    if (step === "recommendation") return "3 model yang cocok untukmu";
    return "Preview di wajahmu";
  }, [step]);

  function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 8 * 1024 * 1024) {
      alert("Maksimal ukuran foto 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result));
      setStep("analysis");
      setAnalysisProgress(10);
      let p = 10;
      const timer = window.setInterval(() => {
        p += 15;
        setAnalysisProgress(Math.min(p, 100));
        if (p >= 100) {
          window.clearInterval(timer);
          window.setTimeout(() => setStep("recommendation"), 350);
        }
      }, 220);
    };
    reader.readAsDataURL(file);
  }

  function reset() {
    setPhoto(null);
    setSelected(styles[0]);
    setAnalysisProgress(0);
    setStep("home");
  }

  return (
    <main className="page">
      <div className="app-shell">
        <header className="topbar">
          <button className="brand" onClick={reset} aria-label="Kembali ke beranda">
            <span className="brand-mark">P</span>
            <span>
              <strong>potram.id</strong>
              <small>Cek dulu. Baru potong.</small>
            </span>
          </button>
          <button className="menu" type="button" aria-label="Menu">☰</button>
        </header>

        <div className="progress-line" aria-hidden="true">
          <span style={{ width: step === "home" ? "10%" : step === "upload" ? "25%" : step === "analysis" ? "50%" : step === "recommendation" ? "75%" : "100%" }} />
        </div>

        {step === "home" && (
          <section className="hero">
            <div className="hero-copy">
              <span className="eyebrow">AI HAIRSTYLE CHECK</span>
              <h1>{headline}</h1>
              <p>Upload foto, dapatkan rekomendasi model rambut yang paling cocok untuk wajah dan rambutmu.</p>
              <label className="primary-button">
                <span>✦</span> Cek Rambut Saya
                <input hidden type="file" accept="image/*" onChange={() => setStep("upload")} />
              </label>
              <div className="free-note">Gratis 3 rekomendasi / hari</div>
            </div>
            <div className="hero-visual">
              <div className="portrait-card">
                <div className="portrait-face">👨🏻</div>
                <div className="hair-shape" />
                <div className="spark s1">✦</div>
                <div className="spark s2">✧</div>
                <div className="floating-tag">Cocok 94%</div>
              </div>
            </div>
          </section>
        )}

        {step === "upload" && (
          <section className="content">
            <button className="back" onClick={() => setStep("home")}>← Kembali</button>
            <span className="eyebrow">STEP 01</span>
            <h1>{headline}</h1>
            <p className="subhead">Gunakan foto wajah yang jelas dari depan agar hasil lebih akurat.</p>

            <label className="upload-box">
              {photo ? <img src={photo} alt="Foto yang dipilih" /> : (
                <>
                  <span className="upload-icon">＋</span>
                  <strong>Pilih foto</strong>
                  <small>JPG, PNG • maksimal 8 MB</small>
                </>
              )}
              <input hidden type="file" accept="image/*" onChange={handlePhoto} />
            </label>

            <div className="tips">
              <strong>Tips foto yang bagus</strong>
              <span>☀️ Cahaya cukup terang</span>
              <span>👤 Wajah menghadap depan</span>
              <span>◌ Rambut terlihat jelas</span>
              <span>🚫 Tanpa kacamata / topi</span>
            </div>

            <label className="primary-button full">
              Lanjutkan
              <input hidden type="file" accept="image/*" onChange={handlePhoto} />
            </label>
          </section>
        )}

        {step === "analysis" && (
          <section className="content centered">
            <span className="eyebrow">STEP 02</span>
            <h1>{headline}</h1>
            <p className="subhead">Mohon tunggu sebentar ya 😊</p>
            <div className="analysis-ring" style={{ "--progress": `${analysisProgress}%` } as React.CSSProperties}>
              {photo ? <img src={photo} alt="Foto sedang dianalisis" /> : <span>AI</span>}
            </div>
            <strong className="percent">{analysisProgress}%</strong>
            <div className="check-list">
              {["Mendeteksi bentuk wajah", "Menganalisis tipe rambut", "Menghitung ketebalan rambut", "Mencari model yang cocok"].map((item, i) => (
                <div key={item} className="check-row">
                  <span className={analysisProgress > i * 25 ? "check done" : "check"}>{analysisProgress > i * 25 ? "✓" : "•"}</span>
                  {item}
                </div>
              ))}
            </div>
            <div className="privacy">🔒 Foto digunakan untuk analisis dan tidak dipublikasikan.</div>
          </section>
        )}

        {step === "recommendation" && (
          <section className="content">
            <button className="back" onClick={() => setStep("home")}>← Beranda</button>
            <span className="eyebrow">HASIL ANALISIS</span>
            <h1>{headline}</h1>
            <p className="subhead">Berdasarkan bentuk wajah dan karakter rambutmu.</p>

            <div className="profile-pill">
              <span>Wajah</span><strong>Oval</strong>
              <span>Rambut</span><strong>Straight • Medium</strong>
            </div>

            <div className="recommendations">
              {styles.map((style, index) => (
                <article className={`style-card ${index === 0 ? "top" : ""}`} key={style.name}>
                  <div className="style-number">{index + 1}</div>
                  <div className="style-avatar">{photo ? <img src={photo} alt="" /> : <span>{style.emoji}</span>}</div>
                  <div className="style-info">
                    <h3>{style.name}</h3>
                    <strong>{style.sub}</strong>
                    <span>Cocok: <b>{style.score}%</b></span>
                    <div className="stars">★★★★★</div>
                    <button onClick={() => { setSelected(style); setStep("preview"); }}>
                      Coba di Wajah Saya
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <button className="secondary-button" onClick={() => setSelected(styles[1])}>
              ✨ Bingung? Pilihkan buat saya
            </button>
          </section>
        )}

        {step === "preview" && (
          <section className="content">
            <button className="back" onClick={() => setStep("recommendation")}>← Rekomendasi</button>
            <span className="eyebrow">AI PREVIEW</span>
            <h1>{headline}</h1>
            <p className="subhead">{selected.name} • {selected.sub}</p>

            <div className="preview-card">
              {photo ? <img src={photo} alt="Preview model rambut" /> : <div className="preview-placeholder">👨🏻</div>}
              <div className="preview-badge">Preview demo</div>
            </div>

            <div className="selected-style">
              <div>
                <strong>{selected.name}</strong>
                <span>{selected.sub} • Cocok {selected.score}%</span>
              </div>
              <div className="stars">★★★★★</div>
            </div>

            <div className="barber-card">
              <strong>💈 Tunjukkan ke barber</strong>
              <p>{selected.description}</p>
              <div className="barber-spec">Samping: Low Fade (0.5–2) · Atas: 5–7 cm · Styling: Matte / Natural</div>
            </div>

            <button className="primary-button full" onClick={reset}>Simpan & Cek Model Lain</button>
            <small className="demo-note">Preview AI asli akan dihubungkan ke Image Generation API pada tahap berikutnya.</small>
          </section>
        )}

        <footer>
          <span>potram.id</span>
          <span>Micro-SaaS MVP • Indonesia</span>
        </footer>
      </div>
    </main>
  );
}
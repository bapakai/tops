 "use client";

import { useEffect, useRef, useState } from "react";

type Step = "home" | "camera" | "analysis" | "results" | "collection" | "preview" | "barber";
type Style = readonly [string, number, string, string];

const styles: Style[] = [
  ["Two Block", 94, "Modern", "Bagian atas medium, sisi ringan."],
  ["Low Fade", 91, "Clean", "Fade rendah yang aman untuk daily."],
  ["Textured Crop", 88, "Casual", "Pendek, bertekstur, mudah ditata."],
  ["Comma Hair", 86, "Korean", "Fringe melengkung dengan volume ringan."],
  ["French Crop", 84, "Short", "Rapi dan praktis untuk aktivitas."],
  ["Middle Part", 82, "Medium", "Natural dengan belahan tengah."],
  ["Crew Cut", 80, "Short", "Praktis, clean, dan minim styling."],
  ["Ivy League", 79, "Classic", "Klasik dengan volume yang tetap rapi."],
  ["Short Quiff", 77, "Classic", "Volume ringan di depan, mudah diatur."]
];

const allStyles = [
  ...styles,
  ["Buzz Cut", 75, "Short", "Super ringkas dan praktis."],
  ["Side Part", 74, "Classic", "Rapi dengan belahan samping."],
  ["Slick Back", 72, "Classic", "Clean dengan rambut diarahkan ke belakang."],
  ["Pompadour", 70, "Classic", "Volume lebih tinggi dan statement."],
  ["Curtain Hair", 69, "Medium", "Natural dengan belahan tengah."],
  ["Wolf Cut", 67, "Modern", "Layered dan lebih berkarakter."],
  ["Mullet", 65, "Modern", "Pendek di depan dengan bagian belakang panjang."],
  ["Curly Top", 64, "Curly", "Mempertahankan tekstur ikal alami."],
  ["Spiky Hair", 62, "Casual", "Tekstur berdiri dengan karakter playful."],
  ["Undercut", 60, "Modern", "Kontras sisi dan bagian atas."],
  ["Taper Fade", 59, "Clean", "Gradasi halus dan versatile."],
  ["Drop Fade", 57, "Clean", "Fade mengikuti kontur kepala."],
  ["Crop Fade", 55, "Short", "Crop ringkas dengan fade."],
  ["Comb Over", 53, "Classic", "Rapi dan mudah dibawa formal."],
  ["Messy Hair", 51, "Casual", "Natural, santai, dan effortless."]
] as Style[];

export default function Topsid() {
  const [step, setStep] = useState<Step>("home");
  const [photo, setPhoto] = useState<string | null>(null);
  const [selected, setSelected] = useState<Style>(styles[0]);
  const [hasChecked, setHasChecked] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState(0);

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
        }, 300);
      }
    }, 160);
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

  function selectStyle(style: Style) {
    setSelected(style);
    setStep("preview");
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

  function reset() {
    stopCamera();
    if (timerRef.current) window.clearInterval(timerRef.current);
    setPhoto(null);
    setSelected(styles[0]);
    setHasChecked(false);
    setRecording(false);
    setSeconds(0);
    setProgress(0);
    setStep("home");
  }

  const posterStyles = styles.slice(0, 9);

  return (
    <main className="site">
      <header>
        <button className="logo" onClick={reset} aria-label="TOPSID home">
          <span>T</span>
          <b>TOPSID<small>CEK DULU. BARU POTONG.</small></b>
        </button>
        <button className="menu" type="button" aria-label="Menu">☰</button>
      </header>

      <nav>
        {["Rekam", "Analisis", "Rekomendasi", "Preview", "Barber"].map((item, index) => (
          <span key={item}><i>{index + 1}</i>{item}</span>
        ))}
      </nav>

      {step === "home" && (
        <section className="home">
          <div className="hero-copy">
            <label>TOP&apos;S COLLECTION • AI HAIRSTYLE CHECK</label>
            <h1>Gaya yang cocok,<em> sebelum dipotong.</em></h1>
            <p>Rekam wajahmu sebentar. TOPSID membantu menemukan gaya rambut yang paling pas buat kamu.</p>
            <button className="cta" onClick={openCamera}>◉ &nbsp; Mulai Cek Rambut</button>
            <small>Gratis 3 rekomendasi / hari • Tanpa daftar</small>
          </div>

          <div className="poster">
            <strong>TOP&apos;S</strong>
            <b>COLLECTION</b>
            <div>
              {posterStyles.map((style, index) => (
                <button key={style[0]} onClick={() => selectStyle(style)}>
                  <span>{["◉", "◒", "◐"][index % 3]}</span>
                  <small>{style[0]}</small>
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
                <p>Rekomendasi personal dari hasil AI Check terakhir.</p>
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
          <h2>Rekam wajahmu <em>secara perlahan.</em></h2>
          <p className="sub">Posisikan wajah di dalam oval, lalu hadap depan, sedikit ke kiri dan kanan.</p>
          <div className="camera">
            {cameraOn ? <video ref={videoRef} autoPlay playsInline muted /> : (
              <div className="fallback">
                <span>👨🏻</span>
                <b>Kamera belum aktif</b>
                <button onClick={openCamera}>Aktifkan Kamera</button>
              </div>
            )}
            <div className="guide" />
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
          <h2>Mengenali wajah <em>dan rambutmu...</em></h2>
          <div className="analysis">
            <div>{photo ? <img src={photo} alt="Foto pengguna" /> : <span>👨🏻</span>}<b>{progress}%</b></div>
            {["Bentuk wajah", "Tekstur rambut", "Ketebalan rambut", "Garis rambut", "Proporsi wajah"].map((item, index) => (
              <p key={item}><i>{progress > index * 20 ? "✓" : "·"}</i>{item}</p>
            ))}
          </div>
          <aside>🔒 Foto hanya digunakan untuk analisis.</aside>
        </section>
      )}

      {step === "results" && (
        <section className="screen">
          <label>STEP 03 • TOP&apos;S FOR YOU</label>
          <h2>Ini 3 gaya terbaik <em>untukmu.</em></h2>
          <div className="profile">
            <span>Wajah <b>Oval</b></span>
            <span>Rambut <b>Lurus</b></span>
            <span>Ketebalan <b>Sedang</b></span>
          </div>
          <div className="list">
            {styles.slice(0, 3).map((style, index) => (
              <article key={style[0]}>
                <b className="rank">{index + 1}</b>
                <div className="stylepic">{photo ? <img src={photo} alt="" /> : <span>{["✦", "◒", "✂"][index]}</span>}</div>
                <div>
                  <small>{style[2]}</small>
                  <h3>{style[0]}</h3>
                  <p>{style[3]}</p>
                  <strong>Cocok {style[1]}%</strong>
                </div>
                <button onClick={() => selectStyle(style)}>Coba di wajahku →</button>
              </article>
            ))}
          </div>
          <div className="collection-note">
            <b>Masih mau lihat-lihat?</b>
            <span>TOP&apos;S Collection berisi 9 gaya pilihan di Home.</span>
          </div>
          <button className="outline wide" onClick={() => setStep("collection")}>Jelajahi semua gaya →</button>
        </section>
      )}

      {step === "collection" && (
        <section className="screen">
          <button className="back" onClick={() => setStep("results")}>← TOP&apos;S For You</button>
          <label>TOP&apos;S COLLECTION</label>
          <h2>Gaya lebih banyak.<br /><em>Pilih yang kamu suka.</em></h2>
          <div className="filters"><button>Semua</button><button>Pendek</button><button>Medium</button><button>Klasik</button></div>
          <div className="grid">
            {allStyles.map((style, index) => (
              <button key={style[0]} onClick={() => selectStyle(style)}>
                <span>{["◉", "◒", "◐", "◓"][index % 4]}</span>
                <b>{style[0]}</b>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "preview" && (
        <section className="screen">
          <button className="back" onClick={() => setStep("results")}>← Rekomendasi</button>
          <label>STEP 04 • PREVIEW</label>
          <h2><em>{selected[0]}</em><br />di wajahmu.</h2>
          <div className="preview">
            {photo ? <img src={photo} alt="Preview" /> : <span>👨🏻</span>}
            <b>PREVIEW DEMO</b>
          </div>
          <div className="angles"><button>Depan</button><button>Samping</button><button>45°</button></div>
          <div className="summary">
            <span>KECOCOKAN<strong>{selected[1]}%</strong></span>
            <span>GAYA<strong>{selected[0]}</strong></span>
            <span>PERAWATAN<strong>Easy</strong></span>
          </div>
          <button className="cta wide" onClick={() => setStep("barber")}>✂ Tunjukkan ke Barber</button>
          <button className="ghost" onClick={() => setStep("results")}>Coba gaya lain</button>
          <small className="demo">Preview AI asli disambungkan pada tahap API.</small>
        </section>
      )}

      {step === "barber" && (
        <section className="screen">
          <label>STEP 05 • BARBER CARD</label>
          <h2>Siap dibawa <em>ke barber.</em></h2>
          <div className="barber">
            <header>
              <div><small>TOPSID RECOMMENDS</small><h3>{selected[0]}</h3><b>Cocok {selected[1]}%</b></div>
              <strong>TOPSID</strong>
            </header>
            <div className="barberpic">{photo ? <img src={photo} alt="" /> : <span>👨🏻</span>}</div>
            <div className="specs">
              <span>SAMPING<b>Low taper / fade</b></span>
              <span>ATAS<b>5–7 cm, textured</b></span>
              <span>STYLING<b>Matte / natural</b></span>
            </div>
            <p>“Mas, saya mau model seperti ini. Bagian samping dibuat ringan, atas tetap natural.”</p>
          </div>
          <div className="actions"><button className="cta" onClick={() => alert("Demo: Barber Card siap dibagikan.")}>↗ Bagikan</button><button className="ghost" onClick={reset}>Selesai</button></div>
        </section>
      )}

      <footer className="foot"><b>TOPSID</b><span>Cek dulu. Baru potong.</span><span>© 2026</span></footer>
    </main>
  );
}

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
  reasons?: string[];
};

type HairProfile = {
  face_shape: string;
  hair_type: string;
  hair_texture: string;
  density: string;
  length: string;
  maintenance_level: string;
};

const fallbackStyles: Style[] = [
  ["two-block","Two Block",94,"Modern","Bagian atas medium, sisi lebih ringan.","Samping low taper • atas 5–7 cm"],
  ["low-fade","Low Fade",91,"Clean","Fade rendah yang aman untuk daily.","Samping low fade • atas natural"],
  ["textured-crop","Textured Crop",88,"Casual","Pendek, bertekstur, mudah ditata.","Samping crop fade • atas textured"],
  ["comma-hair","Comma Hair",86,"Korean","Fringe melengkung dengan volume ringan.","Samping taper • fringe medium"],
  ["french-crop","French Crop",84,"Short","Rapi, praktis, dan minim styling.","Samping fade • fringe pendek"],
  ["middle-part","Middle Part",82,"Medium","Natural dengan belahan tengah.","Samping taper • atas 8–10 cm"],
  ["crew-cut","Crew Cut",80,"Short","Praktis, clean, dan mudah dirawat.","Samping fade • atas pendek"],
  ["ivy-league","Ivy League",79,"Classic","Klasik dengan volume yang tetap rapi.","Samping taper • atas 5 cm"],
  ["short-quiff","Short Quiff",77,"Classic","Volume ringan di depan.","Samping taper • depan bervolume"],
  ["buzz-cut","Buzz Cut",75,"Short","Super ringkas dan praktis.","Clipper pendek merata"],
  ["side-part","Side Part",74,"Classic","Rapi dengan belahan samping.","Taper • side part natural"],
  ["slick-back","Slick Back",72,"Classic","Clean dengan rambut diarahkan ke belakang.","Taper • atas medium panjang"],
  ["pompadour","Pompadour",70,"Classic","Volume lebih tinggi dan statement.","Taper • volume atas tinggi"],
  ["curtain-hair","Curtain Hair",69,"Medium","Natural dengan belahan tengah.","Layer medium • fringe panjang"],
  ["wolf-cut","Wolf Cut",67,"Modern","Layered dan lebih berkarakter.","Layer medium • tekstur natural"],
  ["mullet","Mullet",65,"Modern","Lebih pendek di depan, panjang di belakang.","Taper • belakang dipanjangkan"],
  ["curly-top","Curly Top",64,"Curly","Mempertahankan tekstur ikal alami.","Samping taper • atas natural"],
  ["spiky-hair","Spiky Hair",62,"Casual","Tekstur berdiri dengan karakter playful.","Samping pendek • atas textured"],
  ["undercut","Undercut",60,"Modern","Kontras sisi dan bagian atas.","Samping undercut • atas panjang"],
  ["taper-fade","Taper Fade",59,"Clean","Gradasi halus dan versatile.","Taper di pelipis dan tengkuk"],
  ["drop-fade","Drop Fade",57,"Clean","Fade mengikuti kontur kepala.","Drop fade • atas natural"],
  ["crop-fade","Crop Fade",55,"Short","Crop ringkas dengan fade.","Crop pendek • fade samping"],
  ["comb-over","Comb Over",53,"Classic","Rapi dan mudah dibawa formal.","Taper • belahan natural"],
  ["messy-hair","Messy Hair",51,"Casual","Natural, santai, dan effortless.","Layer medium • textured"],
  ["high-fade","High Fade",49,"Clean","Kontras lebih kuat dan sporty.","High fade • atas medium"],
  ["caesar-cut","Caesar Cut",47,"Short","Fringe pendek dengan bentuk tegas.","Fade • fringe pendek"],
  ["textured-quiff","Textured Quiff",45,"Modern","Quiff ringan dengan tekstur natural.","Taper • atas textured"],
  ["brush-up","Brush Up",43,"Casual","Rambut diarahkan ke atas dengan volume.","Taper • top medium"],
  ["long-layer","Long Layer",41,"Long","Layer panjang dengan jatuh natural.","Layer panjang • ujung natural"],
  ["shag","Shag",39,"Modern","Layer ringan dengan karakter messy.","Layer • fringe medium"],
].map(([id,name,score,category,description,cut]) => ({id,name,score,category,description,cut} as Style));

function remoteStyle(item: any): Style {
  return {
    id: String(item.id),
    name: String(item.name),
    score: 0,
    category: String(item.category ?? "Classic"),
    description: String(item.description ?? "Model rambut pilihan TOP'S Collection."),
    cut: String(item.barber_note ?? "Tanyakan detail potongan kepada barber."),
  };
}

export default function Topsid() {
  const [collection, setCollection] = useState<Style[]>(fallbackStyles);
  const [recommendations, setRecommendations] = useState<Style[]>([]);
  const [step, setStep] = useState<Step>("home");
  const [photo, setPhoto] = useState<string | null>(null);
  const [selected, setSelected] = useState<Style>(fallbackStyles[0]);
  const [hasChecked, setHasChecked] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState(0);
  const [cameraError, setCameraError] = useState("");
  const [recommendationError, setRecommendationError] = useState("");
  const [filter, setFilter] = useState("Semua");
  const [query, setQuery] = useState("");

  const profile: HairProfile = {
    face_shape: "oval",
    hair_type: "straight",
    hair_texture: "straight",
    density: "medium",
    length: "medium",
    maintenance_level: "medium",
  };

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const topNine = collection.slice(0, 9);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hairstyles?limit=30")
      .then(async r => {
        if (!r.ok) throw new Error("collection request failed");
        return r.json();
      })
      .then(payload => {
        if (!cancelled && Array.isArray(payload?.data) && payload.data.length) {
          setCollection(payload.data.map(remoteStyle));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (timerRef.current) window.clearInterval(timerRef.current);
  }, []);

  async function loadRecommendations() {
    setRecommendationError("");
    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, limit: 3 }),
      });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload?.data) || !payload.data.length) {
        throw new Error(payload?.error || "recommendation failed");
      }
      const result: Style[] = payload.data.map((item: any) => ({
        ...remoteStyle(item),
        score: Number(item.score ?? 0),
        reasons: Array.isArray(item.reasons) ? item.reasons : [],
      }));
      setRecommendations(result);
      setSelected(result[0]);
    } catch {
      setRecommendations([]);
      setSelected(collection[0] ?? fallbackStyles[0]);
      setRecommendationError("Rekomendasi belum tersedia. Menampilkan pilihan awal TOP'S Collection.");
    }
  }

  async function openCamera() {
    setStep("camera");
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Browser belum mendukung kamera. Pilih foto dari galeri.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      window.setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 50);
    } catch {
      setCameraError("Kamera belum mendapat izin. Aktifkan izin kamera atau pilih foto dari galeri.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
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
        window.setTimeout(async () => {
          await loadRecommendations();
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
    if (recording) { captureFrame(); return; }
    setRecording(true);
    setSeconds(0);
    timerRef.current = window.setInterval(() => {
      setSeconds(current => {
        if (current >= 4) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          window.setTimeout(captureFrame, 100);
          return 5;
        }
        return current + 1;
      });
    }, 1000);
  }

  function gallery(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => { setPhoto(String(reader.result)); startAnalysis(); };
    reader.readAsDataURL(file);
  }

  function reset() {
    stopCamera();
    if (timerRef.current) window.clearInterval(timerRef.current);
    setStep("home");
    setPhoto(null);
    setRecommendations([]);
    setSelected(collection[0] ?? fallbackStyles[0]);
    setHasChecked(false);
    setRecording(false);
    setSeconds(0);
    setProgress(0);
    setCameraError("");
    setRecommendationError("");
    setFilter("Semua");
    setQuery("");
  }

  const filtered = useMemo(() => collection.filter(s =>
    (filter === "Semua" || s.category === filter) &&
    s.name.toLowerCase().includes(query.toLowerCase())
  ), [collection, filter, query]);

  return (
    <main className="site">
      <header>
        <button className="logo" onClick={reset} aria-label="TOPSID home">
          <span>T</span><b>TOPSID<small>CARI MODEL RAMBUTMU</small></b>
        </button>
        <button className="menu" type="button" aria-label="Menu">☰</button>
      </header>

      <div className="journey">
        {["Cari","Rekam","Analisis","Pilih","Preview","Barber"].map((x,i) =>
          <span key={x}><i>{i+1}</i>{x}</span>
        )}
      </div>

      {step === "home" && <section className="home">
        <div className="hero-copy">
          <div className="hero-icon" aria-hidden="true">✂</div>
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
            {topNine.map((style,index) => <button className={`poster-card tilt-${index%3}`} key={style.id} onClick={() => {setSelected(style);setStep("preview")}}>
              <span className={`portrait h${(index%6)+1}`} aria-hidden="true"><i /></span>
              <small>{style.name}</small>
            </button>)}
          </div>
          <footer>9 GAYA PILIHAN</footer>
        </div>
        {hasChecked && recommendations.length > 0 && <div className="for-you">
          <div><label>TOP&apos;S FOR YOU</label><h2>3 gaya yang paling cocok buatmu.</h2><p>Model yang paling cocok dari hasil cek terakhir kamu.</p></div>
          <button onClick={() => setStep("results")}>Lihat rekomendasi →</button>
        </div>}
      </section>}

      {step === "camera" && <section className="screen camera-screen">
        <button className="back" onClick={() => {stopCamera();setStep("home")}}>← Kembali</button>
        <label>STEP 01 • REKAM</label>
        <h2>Rekam wajahmu <em>secara perlahan.</em></h2>
        <p className="sub">Posisikan wajah di dalam oval, lalu hadap depan, sedikit ke kiri dan kanan.</p>
        <div className="camera">
          {cameraOn ? <video ref={videoRef} autoPlay playsInline muted /> :
            <div className="fallback"><span>👨🏻</span><b>Kamera belum aktif</b><button onClick={openCamera}>Aktifkan Kamera</button></div>}
          <div className="guide" />
        </div>
        {cameraError && <p className="error">{cameraError}</p>}
        <div className="controls"><small>00:{String(seconds).padStart(2,"0")}</small>
          <button className={recording ? "rec active" : "rec"} onClick={toggleRecording}><i /></button><small>↻</small>
        </div>
        <p className="hint">{recording ? "Hadap depan → kiri → kanan" : "Tekan tombol untuk merekam ±5 detik"}</p>
        <label className="gallery">Atau pilih foto dari galeri<input type="file" accept="image/*" onChange={e => gallery(e.target.files?.[0])}/></label>
      </section>}

      {step === "analysis" && <section className="screen center">
        <label>STEP 02 • ANALISIS AI</label><h2>Mengenali wajah <em>dan rambutmu...</em></h2>
        <div className="analysis"><div>{photo ? <img src={photo} alt="Foto" /> : <span>👨🏻</span>}<b>{progress}%</b></div>
          {["Bentuk wajah","Tekstur rambut","Ketebalan rambut","Garis rambut","Proporsi wajah"].map((x,i) =>
            <p key={x}><i>{progress > i*20 ? "✓" : "·"}</i>{x}</p>)}
        </div><aside>🔒 Foto hanya digunakan untuk analisis.</aside>
      </section>}

      {step === "results" && <section className="screen">
        <label>STEP 03 • HASIL ANALISIS</label><h2>Ini 3 gaya terbaik <em>untukmu.</em></h2>
        <div className="profile"><span>Wajah <b>{profile.face_shape}</b></span><span>Rambut <b>{profile.hair_type}</b></span><span>Ketebalan <b>{profile.density}</b></span></div>
        {recommendationError && <p className="error">{recommendationError}</p>}
        <div className="list">
          {(recommendations.length ? recommendations : collection.slice(0,3)).map((style,i) =>
            <article key={style.id}><b className="rank">{i+1}</b><div className="stylepic">{photo ? <img src={photo} alt="" /> : <span>{["✦","◒","✂"][i]}</span>}</div>
              <div><small>{style.category}</small><h3>{style.name}</h3><p>{style.description}</p>
                <strong>{style.score > 0 ? `Cocok ${style.score}%` : "Rekomendasi TOPSID"}</strong>
                {style.reasons?.[0] && <small className="match-reason">{style.reasons[0]}</small>}
              </div>
              <button onClick={() => {setSelected(style);setStep("preview")}}>Coba di wajahku →</button>
            </article>
          )}
        </div>
        <button className="outline wide" onClick={() => setStep("collection")}>Lihat TOP&apos;S Collection • 30 gaya</button>
      </section>}

      {step === "collection" && <section className="screen">
        <button className="back" onClick={() => setStep("results")}>← Hasil untukmu</button>
        <label>TOP&apos;S COLLECTION</label><h2>30 gaya. <em>Pilih yang kamu suka.</em></h2>
        <div className="filters">{["Semua","Short","Medium","Long","Classic","Modern"].map(x =>
          <button key={x} className={filter===x?"active":""} onClick={() => setFilter(x)}>{x}</button>)}</div>
        <input className="search" placeholder="Cari model rambut..." value={query} onChange={e => setQuery(e.target.value)} />
        <div className="grid">{filtered.map(style =>
          <button key={style.id} onClick={() => {setSelected(style);setStep("preview")}}><span>✦</span><b>{style.name}</b></button>)}</div>
      </section>}

      {step === "preview" && <section className="screen center">
        <button className="back" onClick={() => setStep(hasChecked ? "results" : "home")}>← Kembali</button>
        <label>STEP 05 • PREVIEW</label><h2>Pilihanmu: <em>{selected.name}</em></h2>
        <div className="preview-card"><div className="stylepic large">{photo ? <img src={photo} alt="" /> : <span>✦</span>}</div>
          <h3>{selected.name}</h3><p>{selected.description}</p><strong>{selected.cut}</strong></div>
        <button className="cta" onClick={() => setStep("barber")}>Lanjut ke Barber →</button>
      </section>}

      {step === "barber" && <section className="screen center">
        <button className="back" onClick={() => setStep("preview")}>← Preview</button>
        <label>STEP 06 • BARBER</label><h2>Siap dibawa ke <em>barber.</em></h2>
        <div className="barber-card"><small>MODEL RAMBUT</small><h2>{selected.name}</h2><p>{selected.cut}</p><hr/><small>CATATAN</small><p>{selected.description}</p></div>
        <button className="outline wide" onClick={reset}>Selesai</button>
      </section>}
    </main>
  );
}

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
  confidence: number;
};

const fallbackStyles: Style[] = [
  ["two-block","Two Block",0,"Modern","Bagian atas medium, sisi lebih ringan.","Samping low taper • atas 5–7 cm"],
  ["low-fade","Low Fade",0,"Clean","Fade rendah yang aman untuk daily.","Samping low fade • atas natural"],
  ["textured-crop","Textured Crop",0,"Casual","Pendek, bertekstur, mudah ditata.","Samping crop fade • atas textured"],
  ["comma-hair","Comma Hair",0,"Korean","Fringe melengkung dengan volume ringan.","Samping taper • fringe medium"],
  ["french-crop","French Crop",0,"Short","Rapi, praktis, dan minim styling.","Samping fade • fringe pendek"],
  ["middle-part","Middle Part",0,"Medium","Natural dengan belahan tengah.","Samping taper • atas 8–10 cm"],
].map(([id,name,score,category,description,cut]) => ({
  id, name, score: Number(score), category, description, cut
}));

function remoteStyle(item: any): Style {
  return {
    id: String(item.id),
    name: String(item.name),
    score: Number(item.score ?? 0),
    category: String(item.category ?? "Classic"),
    description: String(item.description ?? "Model rambut pilihan TOP'S Collection."),
    cut: String(item.barber_note ?? item.cut ?? "Tanyakan detail potongan kepada barber."),
    reasons: Array.isArray(item.reasons) ? item.reasons : [],
  };
}

export default function Topsid() {
  const [collection, setCollection] = useState<Style[]>(fallbackStyles);
  const [recommendations, setRecommendations] = useState<Style[]>([]);
  const [step, setStep] = useState<Step>("home");
  const [photo, setPhoto] = useState<string | null>(null);
  const [profile, setProfile] = useState<HairProfile | null>(null);
  const [selected, setSelected] = useState<Style | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("Semua");
  const [query, setQuery] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const topNine = collection.slice(0, 9);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/hairstyles?limit=30")
      .then(async (r) => {
        if (!r.ok) throw new Error("collection request failed");
        return r.json();
      })
      .then((payload) => {
        if (!cancelled && Array.isArray(payload?.data) && payload.data.length) {
          setCollection(payload.data.map(remoteStyle));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  async function runAI(image: string) {
    setError("");
    setStage("Membaca karakter rambutmu...");
    setProgress(20);

    const analyzeResponse = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    });

    const analyzeData = await analyzeResponse.json();

    if (!analyzeResponse.ok) {
      throw new Error(analyzeData?.error || "Analisis AI gagal.");
    }

    const detected = analyzeData?.data as HairProfile | undefined;

    if (!detected) {
      throw new Error("TOPSID tidak menerima hasil analisis AI.");
    }

    setProfile(detected);
    setProgress(58);
    setStage("Mencari model yang paling cocok...");

    const recommendationResponse = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile: {
          face_shape: detected.face_shape,
          hair_type: detected.hair_type,
          hair_texture: detected.hair_texture,
          density: detected.density,
          length: detected.length,
        },
        limit: 3,
      }),
    });

    const recommendationData = await recommendationResponse.json();

    if (!recommendationResponse.ok) {
      throw new Error(
        recommendationData?.error || "Scoring Engine belum menghasilkan rekomendasi."
      );
    }

    const items = Array.isArray(recommendationData?.data)
      ? recommendationData.data.map(remoteStyle)
      : [];

    if (!items.length) {
      throw new Error("TOPSID belum menemukan rekomendasi yang cocok.");
    }

    setProgress(100);
    setStage("Selesai");
    setRecommendations(items);
    setSelected(items[0]);
  }

  async function startAnalysis(image: string) {
    setPhoto(image);
    setProfile(null);
    setRecommendations([]);
    setSelected(null);
    setStep("analysis");
    setProgress(5);
    setStage("Menyiapkan analisis AI...");
    setError("");

    try {
      await runAI(image);
      window.setTimeout(() => setStep("results"), 350);
    } catch (err) {
      setProgress(0);
      setStage("");
      setError(err instanceof Error ? err.message : "Analisis belum berhasil.");
    }
  }

  async function openCamera() {
    setStep("camera");
    setError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Browser belum mendukung kamera. Pilih foto dari galeri.");
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
      setCameraOn(true);

      window.setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 50);
    } catch {
      setError("Kamera belum mendapat izin. Aktifkan izin kamera atau pilih foto dari galeri.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  function captureFrame() {
    const video = videoRef.current;

    if (!video) {
      setError("Kamera belum siap. Coba lagi.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;

    const context = canvas.getContext("2d");

    if (!context) {
      setError("Tidak bisa mengambil frame kamera.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const image = canvas.toDataURL("image/jpeg", 0.88);

    stopCamera();
    setRecording(false);
    startAnalysis(image);
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

  function gallery(file?: File) {
    if (!file || !file.type.startsWith("image/")) {
      setError("Gunakan foto JPG, PNG, atau WebP.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const image = String(reader.result || "");
      startAnalysis(image);
    };

    reader.readAsDataURL(file);
  }

  function reset() {
    stopCamera();

    if (timerRef.current) window.clearInterval(timerRef.current);

    setStep("home");
    setPhoto(null);
    setProfile(null);
    setRecommendations([]);
    setSelected(null);
    setRecording(false);
    setSeconds(0);
    setProgress(0);
    setStage("");
    setError("");
    setFilter("Semua");
    setQuery("");
  }

  const filtered = useMemo(
    () =>
      collection.filter(
        (style) =>
          (filter === "Semua" || style.category === filter) &&
          style.name.toLowerCase().includes(query.toLowerCase())
      ),
    [collection, filter, query]
  );

  return (
    <main className="site">
      <header>
        <button className="logo" onClick={reset} aria-label="TOPSID home">
          <span>T</span>
          <b>
            TOPSID
            <small>CARI MODEL RAMBUTMU</small>
          </b>
        </button>

        <button className="menu" type="button" aria-label="Menu">
          ☰
        </button>
      </header>

      <div className="journey">
        {["Cari", "Rekam", "Analisis", "Pilih", "Preview", "Barber"].map(
          (item, index) => (
            <span key={item}>
              <i>{index + 1}</i>
              {item}
            </span>
          )
        )}
      </div>

      {step === "home" && (
        <section className="home">
          <div className="hero-copy">
            <div className="hero-icon" aria-hidden="true">
              ✂
            </div>

            <label>TOP&apos;S COLLECTION • AI HAIRSTYLE CHECK</label>

            <h1>
              Cari model rambutmu,
              <em> yang paling cocok.</em>
            </h1>

            <p>
              Rekam sebentar. TOPSID membaca karakter rambutmu lalu mencarikan
              model yang paling cocok.
            </p>

            <button className="cta" onClick={openCamera}>
              ✦ &nbsp; Cari Tahu Sekarang
            </button>

            <small>Coba gratis • Tanpa daftar</small>
          </div>

          <div className="poster">
            <div className="poster-title">
              top&apos;s <span>collection</span>
            </div>

            <div className="poster-rule" />

            <div className="poster-grid">
              {topNine.map((style, index) => (
                <button
                  className={`poster-card tilt-${index % 3}`}
                  key={style.id}
                  onClick={() => {
                    setSelected(style);
                    setStep("preview");
                  }}
                >
                  <span
                    className={`portrait h${(index % 6) + 1}`}
                    aria-hidden="true"
                  >
                    <i />
                  </span>
                  <small>{style.name}</small>
                </button>
              ))}
            </div>

            <footer>9 GAYA PILIHAN</footer>
          </div>
        </section>
      )}

      {step === "camera" && (
        <section className="screen camera-screen">
          <button
            className="back"
            onClick={() => {
              stopCamera();
              setStep("home");
              setError("");
            }}
          >
            ← Kembali
          </button>

          <label>STEP 01 • REKAM</label>

          <h2>
            Rekam wajahmu <em>secara perlahan.</em>
          </h2>

          <p className="sub">
            Posisikan wajah di dalam oval. Hadap depan, lalu sedikit ke kiri
            dan kanan.
          </p>

          <div className="camera">
            {cameraOn ? (
              <video ref={videoRef} autoPlay playsInline muted />
            ) : (
              <div className="fallback">
                <span>👨🏻</span>
                <b>Kamera belum aktif</b>
                <button onClick={openCamera}>Aktifkan Kamera</button>
              </div>
            )}

            <div className="guide" />
          </div>

          {error && <p className="error">{error}</p>}

          <div className="controls">
            <small>00:{String(seconds).padStart(2, "0")}</small>

            <button
              className={recording ? "rec active" : "rec"}
              onClick={toggleRecording}
            >
              <i />
            </button>

            <small>↻</small>
          </div>

          <p className="hint">
            {recording
              ? "Hadap depan → kiri → kanan"
              : "Tekan tombol untuk merekam ±5 detik"}
          </p>

          <label className="gallery">
            Atau pilih foto dari galeri
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => gallery(event.target.files?.[0])}
            />
          </label>
        </section>
      )}

      {step === "analysis" && (
        <section className="screen center">
          <label>STEP 02 • ANALISIS AI</label>

          <h2>
            Mengenali wajah <em>dan rambutmu...</em>
          </h2>

          <div className="analysis">
            <div>
              {photo ? (
                <img src={photo} alt="Foto untuk analisis TOPSID" />
              ) : (
                <span>✦</span>
              )}

              <b>{progress}%</b>

              {progress > 0 && progress < 100 && <span className="scan" />}
            </div>

            <div className="analysis-progress">
              <span style={{ width: `${progress}%` }} />
            </div>

            <p>
              <i>{progress >= 20 ? "✓" : "·"}</i>
              Membaca karakter rambut
            </p>

            <p>
              <i>{progress >= 58 ? "✓" : "·"}</i>
              Mencocokkan model rambut
            </p>

            <p>
              <i>{progress >= 100 ? "✓" : "·"}</i>
              Menentukan TOP 3
            </p>
          </div>

          <aside>🔒 Foto hanya digunakan untuk analisis.</aside>

          {stage && <p className="hint">{stage}</p>}

          {error && <p className="error">{error}</p>}

          {error && (
            <button className="outline" onClick={() => photo && startAnalysis(photo)}>
              Coba Lagi
            </button>
          )}
        </section>
      )}

      {step === "results" && (
        <section className="screen">
          <label>STEP 03 • HASIL ANALISIS</label>

          <h2>
            Ini 3 gaya terbaik <em>untukmu.</em>
          </h2>

          {profile && (
            <div className="profile">
              <span>
                Wajah <b>{profile.face_shape}</b>
              </span>
              <span>
                Rambut <b>{profile.hair_type}</b>
              </span>
              <span>
                Tekstur <b>{profile.hair_texture}</b>
              </span>
              <span>
                Ketebalan <b>{profile.density}</b>
              </span>
              <span>
                Panjang <b>{profile.length}</b>
              </span>
            </div>
          )}

          {error && <p className="error">{error}</p>}

          <div className="list">
            {recommendations.map((style, index) => (
              <article
                key={style.id}
                className={index === 0 ? "recommended" : ""}
              >
                <b className="rank">{index + 1}</b>

                <div className="stylepic">
                  <span>{["✦", "◒", "✂"][index] || "✦"}</span>
                </div>

                <div>
                  <small>{style.category}</small>
                  <h3>{style.name}</h3>
                  <p>{style.description}</p>

                  <strong>
                    {style.score > 0
                      ? `Cocok ${style.score}%`
                      : "Cocok untuk profilmu"}
                  </strong>

                  {style.reasons?.[0] && (
                    <small className="match-reason">
                      {style.reasons[0]}
                    </small>
                  )}
                </div>

                <button
                  onClick={() => {
                    setSelected(style);
                    setStep("preview");
                  }}
                >
                  Coba model ini →
                </button>
              </article>
            ))}
          </div>

          <button
            className="outline wide"
            onClick={() => setStep("collection")}
          >
            Lihat TOP&apos;S Collection • 30 gaya
          </button>
        </section>
      )}

      {step === "collection" && (
        <section className="screen">
          <button className="back" onClick={() => setStep("results")}>
            ← Hasil untukmu
          </button>

          <label>TOP&apos;S COLLECTION</label>

          <h2>
            30 gaya. <em>Pilih yang kamu suka.</em>
          </h2>

          <div className="filters">
            {["Semua", "Short", "Medium", "Long", "Classic", "Modern"].map(
              (item) => (
                <button
                  key={item}
                  className={filter === item ? "active" : ""}
                  onClick={() => setFilter(item)}
                >
                  {item}
                </button>
              )
            )}
          </div>

          <input
            className="search"
            placeholder="Cari model rambut..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="grid">
            {filtered.map((style) => (
              <button
                key={style.id}
                onClick={() => {
                  setSelected(style);
                  setStep("preview");
                }}
              >
                <span>✦</span>
                <b>{style.name}</b>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "preview" && selected && (
        <section className="screen center">
          <button
            className="back"
            onClick={() =>
              setStep(recommendations.length ? "results" : "home")
            }
          >
            ← Kembali
          </button>

          <label>STEP 05 • PREVIEW</label>

          <h2>
            Pilihanmu: <em>{selected.name}</em>
          </h2>

          <div className="preview-card">
            <div className="stylepic large">
              <span>✦</span>
            </div>

            <h3>{selected.name}</h3>
            <p>{selected.description}</p>

            {selected.score > 0 && (
              <strong>Cocok {selected.score}%</strong>
            )}

            <p>{selected.cut}</p>
          </div>

          <button className="cta" onClick={() => setStep("barber")}>
            Lanjut ke Barber →
          </button>
        </section>
      )}

      {step === "barber" && selected && (
        <section className="screen center">
          <button className="back" onClick={() => setStep("preview")}>
            ← Preview
          </button>

          <label>STEP 06 • BARBER</label>

          <h2>
            Siap dibawa ke <em>barber.</em>
          </h2>

          <div className="barber-card">
            <small>MODEL RAMBUT</small>
            <h2>{selected.name}</h2>
            <p>{selected.cut}</p>
            <hr />
            <small>KENAPA COCOK</small>
            <p>{selected.description}</p>
          </div>

          <button className="outline wide" onClick={reset}>
            Selesai
          </button>
        </section>
      )}
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

type HairProfile = {
  face_shape: string | null;
  hair_type: string | null;
  hair_texture: string | null;
  density: string | null;
  length: string | null;
  confidence?: number;
};

type Style = {
  id: string;
  name: string;
  score?: number;
  category?: string | null;
  description?: string | null;
  barber_note?: string | null;
  cut?: string | null;
  reasons?: string[];
};

export default function Page() {
  const [photo, setPhoto] = useState<string | null>(null);
  const [profile, setProfile] = useState<HairProfile | null>(null);
  const [styles, setStyles] = useState<Style[]>([]);
  const [selected, setSelected] = useState<Style | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");

  function handlePhoto(file?: File) {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Gunakan foto JPG, PNG, atau WebP.");
      return;
    }

    setError("");
    setProfile(null);
    setStyles([]);
    setSelected(null);

    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function findMyStyles() {
    if (!photo) {
      setError("Tambahkan foto kamu dulu.");
      return;
    }

    setLoading(true);
    setError("");
    setStyles([]);
    setSelected(null);

    try {
      setStage("Membaca karakter rambutmu...");

      const analyzeResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: photo }),
      });

      const analyzeData = await analyzeResponse.json();

      if (!analyzeResponse.ok) {
        throw new Error(
          analyzeData?.error || "Analisis foto belum berhasil."
        );
      }

      const detected: HairProfile = analyzeData?.data || {};
      setProfile(detected);

      setStage("Mencari model yang paling cocok...");

      const recommendationResponse = await fetch(
        "/api/recommendations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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
        }
      );

      const recommendationData =
        await recommendationResponse.json();

      if (!recommendationResponse.ok) {
        throw new Error(
          recommendationData?.error ||
            "Rekomendasi belum berhasil."
        );
      }

      const items: Style[] = Array.isArray(
        recommendationData?.data
      )
        ? recommendationData.data
        : [];

      setStyles(items);

      if (items[0]) {
        setSelected(items[0]);
      }

      setStage("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan. Silakan coba lagi."
      );
      setStage("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="site">
      <header>
        <div className="logo" aria-label="TOPSID">
          <span>T</span>
          <b>
            TOPSID
            <small>CARI MODEL RAMBUTMU</small>
          </b>
        </div>
      </header>

      <section className="screen">
        <label>TOPSID</label>

        <h1>
          Cari <em>Model Rambutmu.</em>
        </h1>

        <p className="sub">
          Upload foto kamu. TOPSID akan membaca karakter rambutmu
          dan mencari model yang paling cocok.
        </p>

        <label className="gallery">
          {photo ? "Ganti Foto" : "Pilih Foto Kamu"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) =>
              handlePhoto(event.target.files?.[0])
            }
          />
        </label>

        {photo && (
          <div className="photo-preview">
            <img src={photo} alt="Foto untuk analisis TOPSID" />
          </div>
        )}

        <button
          type="button"
          className="cta"
          onClick={findMyStyles}
          disabled={!photo || loading}
        >
          {loading ? stage || "Menganalisis..." : "Cari Tahu Sekarang"}
        </button>

        {error && <p className="error">{error}</p>}

        {profile && (
          <section className="analysis">
            <label>HASIL ANALISIS</label>

            <div className="profile-grid">
              <div>
                <small>Bentuk wajah</small>
                <strong>{profile.face_shape || "—"}</strong>
              </div>

              <div>
                <small>Tipe rambut</small>
                <strong>{profile.hair_type || "—"}</strong>
              </div>

              <div>
                <small>Tekstur</small>
                <strong>{profile.hair_texture || "—"}</strong>
              </div>

              <div>
                <small>Ketebalan</small>
                <strong>{profile.density || "—"}</strong>
              </div>

              <div>
                <small>Panjang</small>
                <strong>{profile.length || "—"}</strong>
              </div>

              <div>
                <small>Confidence</small>
                <strong>
                  {typeof profile.confidence === "number"
                    ? `${profile.confidence}%`
                    : "—"}
                </strong>
              </div>
            </div>
          </section>
        )}

        {styles.length > 0 && (
          <section className="recommendations">
            <label>TOP 3 UNTUKMU</label>

            <h2>
              Model yang <em>paling cocok.</em>
            </h2>

            <div className="list">
              {styles.map((style, index) => (
                <article
                  key={style.id}
                  className={
                    selected?.id === style.id
                      ? "selected"
                      : ""
                  }
                >
                  <b className="rank">{index + 1}</b>

                  <div className="stylepic">
                    {photo ? (
                      <img src={photo} alt="" />
                    ) : (
                      <span>✦</span>
                    )}
                  </div>

                  <div>
                    <small>
                      {style.category || "TOP'S Collection"}
                    </small>

                    <h3>{style.name}</h3>

                    <p>
                      {style.description ||
                        "Model rambut pilihan TOPSID."}
                    </p>

                    {typeof style.score === "number" &&
                      style.score > 0 && (
                        <strong>
                          Cocok {style.score}%
                        </strong>
                      )}

                    {style.reasons?.[0] && (
                      <small className="match-reason">
                        {style.reasons[0]}
                      </small>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelected(style)}
                  >
                    Lihat Model →
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        {selected && styles.length > 0 && (
          <section className="preview-panel">
            <label>MODEL PILIHAN</label>

            <h2>
              {selected.name} <em>untukmu.</em>
            </h2>

            <div className="preview-card">
              <div className="stylepic large">
                {photo ? (
                  <img
                    src={photo}
                    alt={`Preview ${selected.name}`}
                  />
                ) : (
                  <span>✦</span>
                )}
              </div>

              <div>
                <small>
                  {selected.category || "TOP'S Collection"}
                </small>

                <h3>{selected.name}</h3>

                {typeof selected.score === "number" &&
                  selected.score > 0 && (
                    <strong>
                      Cocok {selected.score}%
                    </strong>
                  )}

                <p>
                  {selected.description ||
                    "Model pilihan berdasarkan karakter rambutmu."}
                </p>

                {selected.reasons?.length ? (
                  <div className="reasons">
                    {selected.reasons
                      .slice(0, 3)
                      .map((reason) => (
                        <span key={reason}>
                          ✓ {reason}
                        </span>
                      ))}
                  </div>
                ) : null}

                {(selected.barber_note ||
                  selected.cut) && (
                  <p>
                    <b>Catatan barber:</b>{" "}
                    {selected.barber_note ||
                      selected.cut}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              className="outline wide"
              onClick={() => {
                const text =
                  `TOPSID — ${selected.name}` +
                  (selected.score
                    ? ` (${selected.score}% cocok)`
                    : "") +
                  `\n${selected.barber_note || selected.cut || ""}`;

                if (navigator.clipboard) {
                  navigator.clipboard.writeText(text);
                }
              }}
            >
              Salin Detail untuk Barber
            </button>
          </section>
        )}
      </section>
    </main>
  );
}

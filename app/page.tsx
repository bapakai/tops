"use client";

import { useEffect, useState } from "react";

type Style = {
  id: string;
  name: string;
  score?: number;
  category?: string;
  description?: string;
  cut?: string;
  reasons?: string[];
};

type PreviewResponse = {
  status?: string;
  preview?: {
    modelName?: string;
    photo?: string | null;
    message?: string;
  };
  error?: string;
};

const defaultProfile = {
  face_shape: "oval",
  hair_type: "straight",
  hair_texture: "straight",
  density: "medium",
  length: "medium",
  maintenance_level: "medium",
};

export default function Page() {
  const [styles, setStyles] = useState<Style[]>([]);
  const [selected, setSelected] = useState<Style | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse["preview"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: defaultProfile, limit: 3 }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Gagal mengambil rekomendasi.");
        return data;
      })
      .then((data) => {
        if (!active) return;
        const items = Array.isArray(data?.data) ? data.data : [];
        setStyles(items);
        if (items[0]) setSelected(items[0]);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Gagal mengambil rekomendasi.");
      });

    return () => {
      active = false;
    };
  }, []);

  async function makePreview(style: Style) {
    setSelected(style);
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: {
            id: style.id,
            name: style.name,
            category: style.category,
            description: style.description,
            barber_note: style.cut,
          },
          photo,
        }),
      });

      const data: PreviewResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Preview gagal dibuat.");
      }

      setPreview(data.preview ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview gagal dibuat.");
    } finally {
      setLoading(false);
    }
  }

  function handlePhoto(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
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
        <label>TOPSID • PREVIEW</label>
        <h1>
          Lihat model yang <em>cocok untukmu.</em>
        </h1>
        <p className="sub">
          Pilih salah satu rekomendasi TOPSID untuk melihat preview sebelum
          dibawa ke barber.
        </p>

        <div className="preview-upload">
          <label className="gallery">
            {photo ? "Ganti foto" : "Tambahkan foto kamu"}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handlePhoto(e.target.files?.[0])}
            />
          </label>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="list">
          {styles.map((style, index) => (
            <article
              key={style.id}
              className={selected?.id === style.id ? "selected" : ""}
            >
              <b className="rank">{index + 1}</b>

              <div className="stylepic">
                {photo ? (
                  <img src={photo} alt="" />
                ) : (
                  <span>{["✦", "◒", "✂"][index] ?? "✦"}</span>
                )}
              </div>

              <div>
                <small>{style.category || "TOP'S Collection"}</small>
                <h3>{style.name}</h3>
                <p>{style.description || "Model rambut pilihan TOPSID."}</p>
                {typeof style.score === "number" && style.score > 0 && (
                  <strong>Cocok {style.score}%</strong>
                )}
                {style.reasons?.[0] && (
                  <small className="match-reason">{style.reasons[0]}</small>
                )}
              </div>

              <button onClick={() => makePreview(style)} disabled={loading}>
                {loading && selected?.id === style.id
                  ? "Menyiapkan..."
                  : "Coba model ini →"}
              </button>
            </article>
          ))}
        </div>

        {selected && (
          <section className="preview-panel">
            <label>PREVIEW PILIHAN</label>
            <h2>
              {selected.name} <em>untukmu.</em>
            </h2>

            <div className="preview-card">
              <div className="stylepic large">
                {preview?.photo || photo ? (
                  <img
                    src={preview?.photo || photo || ""}
                    alt={`Preview ${selected.name}`}
                  />
                ) : (
                  <span>✦</span>
                )}
              </div>

              <div>
                <small>{selected.category || "TOP'S Collection"}</small>
                <h3>{selected.name}</h3>

                {typeof selected.score === "number" && selected.score > 0 && (
                  <strong>Cocok {selected.score}%</strong>
                )}

                <p>
                  {selected.description ||
                    "Model pilihan berdasarkan profil rambutmu."}
                </p>

                {selected.reasons?.length ? (
                  <div className="reasons">
                    {selected.reasons.slice(0, 3).map((reason) => (
                      <span key={reason}>✓ {reason}</span>
                    ))}
                  </div>
                ) : null}

                {selected.cut && (
                  <p>
                    <b>Catatan barber:</b> {selected.cut}
                  </p>
                )}
              </div>
            </div>

            <div className="preview-actions">
              <button
                className="cta"
                onClick={() => makePreview(selected)}
                disabled={loading}
              >
                {loading ? "Menyiapkan Preview..." : "Coba Model Ini"}
              </button>

              <button
                className="outline wide"
                onClick={() => {
                  const text = `TOPSID — ${selected.name}${selected.score ? ` (${selected.score}% cocok)` : ""}\n${selected.cut || ""}`;
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(text);
                  }
                }}
              >
                Salin detail untuk Barber
              </button>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

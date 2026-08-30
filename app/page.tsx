"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

type Step = "home" | "capture" | "analysis" | "results" | "preview" | "fit";
type Style = {
  id: string; name: string; score: number; category: string; description: string;
  cut: string; reasons: string[]; referenceImage?: string;
};
type Profile = {
  face_shape: string | null; hair_type: string | null; hair_texture: string | null;
  density: string | null; length: string | null; confidence: number;
};
type FitResult = {
  score: number; model: Style; profile: Profile; reasons: string[]; adjustments: string[];
};

const FALLBACK: Style[] = [
  ["low-fade","Low Fade","Clean","Fade rendah yang rapi untuk daily.","Low fade • atas natural"],
  ["taper-fade","Taper Fade","Clean","Sisi lebih natural dengan gradasi halus.","Taper di samping & belakang • atas natural"],
  ["drop-fade","Drop Fade","Clean","Fade mengikuti kontur kepala untuk hasil lebih terstruktur.","Drop fade • atas medium"],
  ["mid-fade","Mid Fade","Clean","Fade di area tengah untuk tampilan tegas dan seimbang.","Mid fade • atas textured"],
  ["high-fade","High Fade","Clean","Kontras lebih kuat dengan sisi yang sangat ringan.","High fade • atas pendek/medium"],
  ["skin-fade","Skin Fade","Clean","Fade sampai kulit untuk tampilan sangat clean.","Skin fade • atas sesuai tekstur"],
  ["two-block","Two Block","Modern","Bagian atas medium dengan sisi lebih ringan.","Two block • fringe natural"],
  ["messy-crop","Messy Crop","Casual","Crop bertekstur dengan karakter natural.","Crop pendek • texture di atas"],
  ["french-crop","French Crop","Short","Pendek, rapi, dan mudah dirawat.","French crop • fringe pendek"],
  ["crew-cut","Crew Cut","Short","Clean, pendek, dan praktis.","Crew cut • taper/fade ringan"],
  ["ivy-league","Ivy League","Classic","Klasik dengan volume yang tetap terkontrol.","Ivy league • taper • side sweep"],
  ["slick-back","Slick Back","Classic","Belakang rapi dengan karakter lebih polished.","Slick back • medium/long"],
  ["curly-top","Curly Top","Curly","Mempertahankan tekstur ikal sebagai karakter utama.","Curly top • sides controlled"],
  ["wavy-top","Wavy Top","Modern","Menonjolkan gelombang alami tanpa menghilangkan volume.","Wavy top • sides controlled"],
  ["pompadour","Pompadour","Classic","Volume depan yang kuat dengan sisi rapi.","Pompadour • taper • volume front"],
].map(([id,name,category,description,cut]) => ({id,name,category,description,cut,reasons:[],score:0}));

const FALLBACK_MAP = new Map(FALLBACK.map(x => [x.id, x]));

function normalizeStyle(x: any): Style {
  const id = String(x?.id || "");
  const f = FALLBACK_MAP.get(id);
  return {
    id, name: String(x?.name || f?.name || "Model Rambut"),
    score: Number(x?.score ?? f?.score ?? 0),
    category: String(x?.category || f?.category || "Style"),
    description: String(x?.description || f?.description || "Model pilihan TOPSID."),
    cut: String(x?.barber_note || x?.cut || f?.cut || "Tanyakan detail potongan kepada barber."),
    reasons: Array.isArray(x?.reasons) ? x.reasons.map(String) : [],
    referenceImage: String(x?.reference_image_url || x?.referenceImage || x?.image_url || "") || `/refs/${id}.jpg`,
  };
}
function label(v: unknown) {
  if (!v || v === "unknown") return "Belum terbaca";
  return String(v).replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
function deviceId() {
  if (typeof window === "undefined") return "";
  const key = "topsid-device-id";
  let id = localStorage.getItem(key);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
  return id;
}

function ReferenceVisual({ model, large=false }: {model:Style; large?:boolean}) {
  const [failed,setFailed]=useState(false);
  if (model.referenceImage && !failed) {
    return <img className={`ts-ref ${large ? "ts-ref-large":""}`} src={model.referenceImage}
      alt={`Referensi ${model.name}`} onError={()=>setFailed(true)} />;
  }
  return <div className={`ts-ref-fallback ${large ? "ts-ref-large":""}`}>
    <div className="ts-hair-placeholder" />
    <strong>{model.name}</strong><small>Referensi TOPSID</small>
  </div>;
}

export default function TopsidPage() {
  const [step,setStep]=useState<Step>("home");
  const [collection,setCollection]=useState<Style[]>(FALLBACK);
  const [recs,setRecs]=useState<Style[]>([]);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [selected,setSelected]=useState<Style|null>(null);
  const [photo,setPhoto]=useState("");
  const [fit,setFit]=useState<FitResult|null>(null);
  const [progress,setProgress]=useState(0);
  const [stage,setStage]=useState("");
  const [error,setError]=useState("");
  const [camera,setCamera]=useState(false);
  const [capturePurpose,setCapturePurpose]=useState<"discover"|"fit">("discover");
  const videoRef=useRef<HTMLVideoElement>(null);
  const streamRef=useRef<MediaStream|null>(null);
  const inputRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    fetch("/api/hairstyles?featured=true&limit=15").then(r=>r.ok?r.json():null).then(p=>{
      if(Array.isArray(p?.data)&&p.data.length) setCollection(p.data.map(normalizeStyle).slice(0,15));
    }).catch(()=>{});
    return ()=>stopCamera();
  },[]);

  function stopCamera(){ streamRef.current?.getTracks().forEach(t=>t.stop()); streamRef.current=null; setCamera(false); }
  function reset(){ stopCamera(); setStep("home"); setRecs([]); setProfile(null); setSelected(null); setPhoto(""); setFit(null); setError(""); setProgress(0); window.scrollTo({top:0,behavior:"smooth"}); }
  function startJourney(){ setCapturePurpose("discover"); setError(""); setStep("capture"); window.scrollTo({top:0}); setTimeout(openCamera,120); }
  function startFitCheck(model:Style){ setSelected(model); setCapturePurpose("fit"); setFit(null); setError(""); setStep("capture"); window.scrollTo({top:0}); setTimeout(openCamera,120); }

  async function openCamera(){
    try {
      if(!navigator.mediaDevices?.getUserMedia) throw new Error();
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:1080},height:{ideal:1440}},audio:false});
      streamRef.current=stream; setCamera(true);
      requestAnimationFrame(()=>{if(videoRef.current) videoRef.current.srcObject=stream;});
    } catch { setCamera(false); setError("Kamera tidak tersedia. Pilih foto dari galeri untuk lanjut."); }
  }

  async function prepareImage(src:string){
    return new Promise<string>((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>{
        const max=1400, scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight));
        const canvas=document.createElement("canvas");
        canvas.width=Math.max(1,Math.round(image.naturalWidth*scale)); canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
        const ctx=canvas.getContext("2d"); if(!ctx) return reject(new Error("Browser tidak mendukung foto."));
        ctx.drawImage(image,0,0,canvas.width,canvas.height); resolve(canvas.toDataURL("image/jpeg",.82));
      };
      image.onerror=()=>reject(new Error("Foto tidak dapat dibaca.")); image.src=src;
    });
  }

  async function runDiscovery(src:string){
    setPhoto(src); setStep("analysis"); setProgress(10); setStage("Menyiapkan foto..."); setError("");
    try{
      const optimized=await prepareImage(src); setPhoto(optimized); setProgress(35); setStage("TOPSID sedang membaca karakter rambut...");
      const a=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:optimized})});
      const ap=await a.json(); if(!a.ok||!ap?.data) throw new Error(ap?.error||"Analisis AI gagal.");
      setProfile(ap.data); setProgress(68); setStage("Mencari model terbaik dari seluruh koleksi TOPSID...");
      const r=await fetch("/api/recommendations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profile:ap.data,device_id:deviceId(),limit:3})});
      const rp=await r.json(); if(!r.ok||!Array.isArray(rp?.data)||!rp.data.length) throw new Error(rp?.error||"Rekomendasi belum tersedia.");
      const list=rp.data.map(normalizeStyle); setRecs(list); setSelected(list[0]); setProgress(100); setStage("Selesai.");
      setTimeout(()=>{setStep("results");window.scrollTo({top:0,behavior:"smooth"});},250);
    }catch(e){setError(e instanceof Error?e.message:"Analisis belum berhasil.");setStep("capture");}
  }

  async function runFit(src:string){
    if(!selected) return;
    setPhoto(src); setStep("analysis"); setProgress(20); setStage(`Mengecek ${selected.name} di wajahmu...`); setError("");
    try{
      const optimized=await prepareImage(src); setPhoto(optimized); setProgress(45);
      const r=await fetch("/api/fit-check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image:optimized,hairstyle_id:selected.id})});
      const rp=await r.json(); if(!r.ok||!rp?.data) throw new Error(rp?.error||"Fit check gagal.");
      setFit(rp.data); setProfile(rp.data.profile); setProgress(100); setStage("Fit check selesai.");
      setTimeout(()=>{setStep("fit");window.scrollTo({top:0,behavior:"smooth"});},250);
    }catch(e){setError(e instanceof Error?e.message:"Fit check belum berhasil.");setStep("preview");}
  }

  async function run(src:string){ const prepared=src; capturePurpose==="fit" ? runFit(prepared) : runDiscovery(prepared); }
  function capture(){
    const video=videoRef.current; if(!video||!video.videoWidth){setError("Kamera belum siap. Coba lagi.");return;}
    const max=1400,scale=Math.min(1,max/Math.max(video.videoWidth,video.videoHeight));
    const canvas=document.createElement("canvas");canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
    const ctx=canvas.getContext("2d");if(!ctx)return;ctx.drawImage(video,0,0,canvas.width,canvas.height);stopCamera();run(canvas.toDataURL("image/jpeg",.82));
  }
  function pickFile(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];e.target.value="";if(!file)return;
    if(!file.type.startsWith("image/")){setError("Gunakan JPG, PNG, atau WebP.");return;}
    const reader=new FileReader();reader.onload=()=>run(String(reader.result||""));reader.readAsDataURL(file);
  }

  const currentStep=step==="home"?1:step==="capture"?2:step==="analysis"?3:step==="results"?4:5;

  return <main className="ts-app">
    <style>{`
      .ts-app,.ts-app *{box-sizing:border-box}.ts-app{--navy:#183451;--blue:#1769df;--muted:#71808d;--line:#dbe4eb;--paper:#fffdf9;--soft:#eef5fc;width:100%;min-height:100vh;overflow-x:hidden;background:var(--paper);color:var(--navy);font-family:Manrope,Arial,sans-serif}.ts-app button{font:inherit;-webkit-tap-highlight-color:transparent}.ts-header{height:78px;background:#fff;border-bottom:1px solid #e5eaf0;display:flex;align-items:center;justify-content:space-between;padding:0 28px;position:sticky;top:0;z-index:50}.ts-brand{border:0;background:transparent;display:flex;align-items:center;gap:12px;color:var(--navy);cursor:pointer;text-align:left}.ts-mark{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:var(--blue);color:#fff;font-size:22px;font-weight:900}.ts-brand-name{display:block;font-size:22px;font-weight:900;line-height:1}.ts-brand-sub{display:block;margin-top:5px;color:#3973ad;font-size:10px;letter-spacing:2px}.ts-menu{width:48px;height:48px;border:1px solid #dce4eb;border-radius:50%;background:#fff;color:var(--navy);font-size:24px;cursor:pointer}.ts-wrap{width:min(1060px,100%);margin:0 auto;padding:0 28px}.ts-journey{background:#fff;border-bottom:1px solid var(--line)}.ts-steps{width:min(1060px,100%);margin:auto;padding:9px 28px;display:grid;grid-template-columns:repeat(5,1fr)}.ts-step{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;color:#a0abb5;font-size:11px;font-weight:800}.ts-step:not(:last-child):after{content:"";position:absolute;height:1px;background:#dce4eb;top:14px;left:calc(50% + 15px);right:calc(-50% + 15px)}.ts-step-dot{width:30px;height:30px;border-radius:50%;border:1px solid #d6dfe7;background:#fff;display:grid;place-items:center;position:relative;z-index:2}.ts-step-active{color:var(--blue)}.ts-step-active .ts-step-dot{background:var(--blue);border-color:var(--blue);color:#fff}.ts-home{padding:52px 0 60px}.ts-eyebrow,.ts-label{color:#286db6;font-size:12px;line-height:1.2;letter-spacing:2px;font-weight:900}.ts-hero-title{max-width:760px;margin:18px 0 20px;font-size:clamp(48px,7vw,82px);line-height:.98;letter-spacing:-4px;font-weight:900}.ts-blue{color:var(--blue)}.ts-lead{max-width:650px;margin:0 0 24px;color:#647382;font-size:20px;line-height:1.5}.ts-primary{border:0;border-radius:16px;background:var(--blue);color:#fff;padding:16px 26px;font-size:17px;font-weight:900;cursor:pointer;box-shadow:0 14px 28px rgba(23,105,223,.18)}.ts-note{margin:10px 0 0;color:#7d8994;font-size:13px}.ts-collection{margin-top:36px;padding:20px;border-radius:24px;background:#10243b;overflow:hidden;border:1px solid #203a55}.ts-collection-title{color:#e5c88e;text-align:center;font-family:Georgia,serif;font-weight:900;font-size:30px;letter-spacing:2px;text-transform:lowercase}.ts-collection-sub{color:#dfc184;text-align:center;font-size:10px;letter-spacing:2px;margin:4px 0 18px}.ts-collection-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;width:100%}.ts-collection-card{width:100%;min-width:0;border:4px solid #d6b67b;border-radius:10px;background:#f5ecd9;padding:5px;cursor:pointer;overflow:hidden}.ts-collection-card .ts-ref{aspect-ratio:1/1}.ts-collection-name{display:block;width:100%;margin:6px 0 1px;color:#172b40;font-size:11px;line-height:1.15;font-weight:900;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ts-ref{width:100%;height:100%;display:block;object-fit:cover;border-radius:5px;background:#e8e0d1}.ts-ref-large{border-radius:0}.ts-ref-fallback{width:100%;aspect-ratio:1/1;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:7px;padding:12px;background:linear-gradient(145deg,#edf5fc,#dceaf7);text-align:center}.ts-ref-fallback strong{font-size:14px}.ts-ref-fallback small{color:#71808d;font-size:10px}.ts-hair-placeholder{width:70px;height:55px;border-radius:55% 55% 35% 40%;background:#1d3045;box-shadow:15px 18px 0 -4px #1d3045}.ts-section{padding:42px 0}.ts-section h2{margin:0 0 22px;font-size:42px;line-height:1;letter-spacing:-2px}.ts-how-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.ts-info-card{background:#fff;border:1px solid var(--line);border-radius:22px;padding:22px}.ts-num{width:38px;height:38px;border-radius:11px;background:#edf5fd;color:var(--blue);display:grid;place-items:center;font-weight:900}.ts-info-card h3{margin:17px 0 8px;font-size:24px}.ts-info-card p{margin:0;color:var(--muted);line-height:1.5}.ts-page{padding:34px 0 70px}.ts-back{border:0;background:none;color:#286db6;padding:0;margin:0 0 16px;font-weight:900;cursor:pointer}.ts-page-title{margin:8px 0 12px;font-size:46px;line-height:1;letter-spacing:-2.5px;font-weight:900}.ts-muted{color:var(--muted);line-height:1.5}.ts-error{margin:14px 0;padding:12px 14px;border-radius:12px;border:1px solid #ffd0d0;background:#fff2f2;color:#a13b3b}.ts-camera{position:relative;width:100%;height:min(650px,72vh);min-height:460px;margin-top:20px;border-radius:24px;overflow:hidden;background:#10243b}.ts-camera video{width:100%;height:100%;display:block;object-fit:cover}.ts-camera-overlay{position:absolute;inset:24px;border:1px solid rgba(255,255,255,.65);border-radius:20px;pointer-events:none}.ts-shutter{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);width:76px;height:76px;border:7px solid #fff;border-radius:50%;background:#fff;cursor:pointer}.ts-gallery{position:absolute;right:18px;bottom:28px;border:0;border-radius:12px;padding:11px 15px;background:#fff;color:var(--navy);font-weight:900;cursor:pointer}.ts-camera-empty{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;text-align:center;color:#fff}.ts-camera-empty h2{margin:0 0 8px}.ts-camera-empty .ts-secondary{margin-top:10px}.ts-secondary{border:1px solid #bdd0df;background:#fff;color:#286db6;border-radius:12px;padding:12px 16px;font-weight:900;cursor:pointer}.ts-analysis{text-align:center}.ts-analysis-photo{width:min(430px,100%);margin:20px auto;border:1px solid var(--line);border-radius:20px;overflow:hidden;background:#fff}.ts-analysis-photo img{width:100%;height:auto;aspect-ratio:4/5;display:block;object-fit:cover}.ts-loader{width:70px;height:70px;margin:20px auto;border:7px solid #e5eef8;border-top-color:var(--blue);border-radius:50%;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.ts-progress{width:min(430px,100%);height:7px;margin:15px auto;border-radius:99px;background:#e7edf3;overflow:hidden}.ts-progress span{display:block;height:100%;background:var(--blue);transition:width .3s}.ts-chips{display:flex;flex-wrap:wrap;gap:9px;margin:18px 0 38px}.ts-chip{padding:10px 12px;border-radius:12px;background:#edf5fd;color:var(--muted);font-size:13px}.ts-chip strong{color:var(--navy)}.ts-results-head{margin-bottom:24px}.ts-recommend-title{margin:8px 0 22px;font-size:42px;line-height:1;letter-spacing:-2px}.ts-recommendations{display:flex;flex-direction:column;gap:16px}.ts-recommendation{display:grid;grid-template-columns:150px minmax(0,1fr);gap:18px;width:100%;min-width:0;padding:14px;border:1px solid var(--line);border-radius:22px;background:#fff;overflow:hidden}.ts-recommendation:first-child{border:2px solid #a8c9eb}.ts-rec-media{width:150px;height:174px;overflow:hidden;border-radius:15px}.ts-rec-content{min-width:0}.ts-rec-content h3{margin:6px 0 5px;font-size:27px;line-height:1.08}.ts-score{color:#178043;font-weight:900;font-size:14px}.ts-reasons{list-style:none;margin:8px 0;padding:0;color:#73808d;font-size:13px;line-height:1.5}.ts-reasons li{margin:2px 0}.ts-outline{border:1px solid #bdd0df;background:#fff;color:#286db6;border-radius:10px;padding:9px 12px;font-weight:900;cursor:pointer}.ts-preview-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr);gap:22px;align-items:start}.ts-preview-main{background:#fff;border:1px solid var(--line);border-radius:22px;overflow:hidden}.ts-preview-main>.ts-ref,.ts-preview-main>.ts-ref-fallback{width:100%;aspect-ratio:4/3}.ts-preview-copy{padding:24px}.ts-preview-copy h2{margin:6px 0 10px;font-size:38px;line-height:1}.ts-detail{margin:18px 0;padding:16px;border-radius:16px;background:#f1f6fb}.ts-detail strong{display:block;margin-bottom:7px}.ts-cta{width:100%;border:0;border-radius:14px;background:var(--blue);color:#fff;padding:14px;font-weight:900;font-size:16px;cursor:pointer}.ts-side-ref{padding:16px;border-radius:22px;background:#10243b;color:#fff}.ts-side-ref h3{margin:4px 0 14px;font-size:22px}.ts-side-ref .ts-ref,.ts-side-ref .ts-ref-fallback{width:100%;aspect-ratio:4/3;border-radius:14px}.ts-fit{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.7fr);gap:22px}.ts-fit-card{background:#fff;border:1px solid var(--line);border-radius:22px;padding:22px}.ts-fit-score{font-size:58px;font-weight:900;line-height:1;color:var(--blue)}.ts-fit-good{color:#178043;font-weight:900}.ts-fit-list{padding-left:20px;color:var(--muted);line-height:1.6}.ts-barber{margin-top:18px;padding:18px;border-radius:16px;background:#f1f6fb}.ts-barber strong{display:block;margin-bottom:8px}@media(max-width:700px){.ts-header{height:72px;padding:0 16px}.ts-mark{width:44px;height:44px}.ts-brand-name{font-size:19px}.ts-brand-sub{font-size:8px;letter-spacing:1.5px}.ts-menu{width:46px;height:46px}.ts-wrap{padding:0 16px}.ts-steps{padding:8px 10px}.ts-step{font-size:9px}.ts-step-dot{width:27px;height:27px}.ts-step:not(:last-child):after{top:13px;left:calc(50% + 14px);right:calc(-50% + 14px)}.ts-home{padding:40px 0 50px}.ts-hero-title{font-size:47px;letter-spacing:-3px}.ts-lead{font-size:18px}.ts-primary{width:100%}.ts-collection{margin-top:28px;padding:10px;border-radius:18px}.ts-collection-title{font-size:22px}.ts-collection-grid{gap:6px}.ts-collection-card{border-width:3px;padding:3px}.ts-collection-name{font-size:8px;margin-top:4px}.ts-section{padding:38px 0}.ts-section h2{font-size:34px}.ts-how-grid{grid-template-columns:1fr}.ts-page{padding:26px 0 50px}.ts-page-title{font-size:35px}.ts-camera{height:calc(100svh - 190px);min-height:430px;border-radius:20px}.ts-recommendation{grid-template-columns:96px minmax(0,1fr);gap:12px;padding:10px;border-radius:18px}.ts-rec-media{width:96px;height:126px}.ts-rec-content h3{font-size:22px}.ts-reasons{font-size:12px;line-height:1.38}.ts-recommend-title{font-size:35px}.ts-preview-grid,.ts-fit{grid-template-columns:1fr}.ts-preview-copy h2{font-size:32px}.ts-fit-score{font-size:48px}}
    `}</style>

    <header className="ts-header">
      <button className="ts-brand" onClick={reset} aria-label="Kembali ke TOPSID"><span className="ts-mark">T</span><span><span className="ts-brand-name">TOPSID</span><span className="ts-brand-sub">CARI MODEL RAMBUTMU</span></span></button>
      <button className="ts-menu" onClick={reset} aria-label="Mulai ulang">☰</button>
    </header>

    {step!=="home" && <nav className="ts-journey"><div className="ts-steps">{["Cari","Rekam","Analisis","Pilih","Preview"].map((n,i)=><div key={n} className={`ts-step ${currentStep>=i+1?"ts-step-active":""}`}><span className="ts-step-dot">{i+1}</span><span>{n}</span></div>)}</div></nav>}

    {step==="home" && <><section className="ts-home"><div className="ts-wrap">
      <div className="ts-eyebrow">TOPSID</div>
      <h1 className="ts-hero-title">Cari model rambutmu,<br/><span className="ts-blue">yang paling cocok.</span></h1>
      <p className="ts-lead">Lihat model rambut yang cocok buat kamu. Cukup rekam sebentar, lalu biarkan TOPSID membantu mencarikannya.</p>
      <button className="ts-primary" onClick={startJourney}>✦ &nbsp; Cari Tahu Sekarang</button><p className="ts-note">Coba gratis · Tanpa daftar</p>
      <div className="ts-collection"><div className="ts-collection-title">top’s collection</div><div className="ts-collection-sub">15 MODEL POPULER</div><div className="ts-collection-grid">
        {collection.slice(0,15).map(m=><button key={m.id} className="ts-collection-card" onClick={()=>{setSelected(m);setStep("preview");window.scrollTo({top:0,behavior:"smooth"})}}><ReferenceVisual model={m}/><span className="ts-collection-name">{m.name}</span></button>)}
      </div></div>
    </div></section>
    <section className="ts-section"><div className="ts-wrap"><h2>Gimana cara kerjanya?</h2><div className="ts-how-grid">
      <article className="ts-info-card"><div className="ts-num">01</div><h3>Rekam</h3><p>Ambil foto rambutmu dari depan dan samping.</p></article>
      <article className="ts-info-card"><div className="ts-num">02</div><h3>Analisis AI</h3><p>TOPSID membaca bentuk wajah dan karakter rambutmu.</p></article>
      <article className="ts-info-card"><div className="ts-num">03</div><h3>Rekomendasi</h3><p>Dapatkan 3 model terbaik dari seluruh knowledge base TOPSID.</p></article>
    </div></div></section></>}

    {step==="capture" && <section className="ts-page"><div className="ts-wrap"><button className="ts-back" onClick={()=>selected&&capturePurpose==="fit"?setStep("preview"):reset()}>← Kembali</button>
      <div className="ts-label">STEP 02 · REKAM</div><h1 className="ts-page-title">{capturePurpose==="fit" ? `Cek ${selected?.name} di wajahmu.` : "Kasih TOPSID gambaran rambutmu."}</h1>
      <p className="ts-muted">{capturePurpose==="fit" ? "Ambil foto dari depan. TOPSID akan mengecek kecocokan model ini." : "Hadap depan dan ambil foto rambutmu. Tidak perlu edit atau pindah halaman."}</p>
      {error&&<div className="ts-error">{error}</div>}<div className="ts-camera">{camera?<><video ref={videoRef} autoPlay playsInline muted/><div className="ts-camera-overlay"/><button className="ts-shutter" onClick={capture} aria-label="Ambil foto"/><button className="ts-gallery" onClick={()=>inputRef.current?.click()}>Galeri</button></>:<div className="ts-camera-empty"><h2>Foto siap?</h2><p>Pilih foto dari galeri atau aktifkan kamera.</p><button className="ts-primary" onClick={openCamera}>Buka Kamera</button><button className="ts-secondary" onClick={()=>inputRef.current?.click()}>Pilih dari Galeri</button></div>}</div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="user" hidden onChange={pickFile}/></div></section>}

    {step==="analysis"&&<section className="ts-page ts-analysis"><div className="ts-wrap"><div className="ts-label">STEP 03 · ANALISIS</div><h1 className="ts-page-title">{capturePurpose==="fit"?"TOPSID sedang mengecek kecocokan.":"TOPSID sedang membaca rambutmu."}</h1>{photo&&<div className="ts-analysis-photo"><img src={photo} alt="Foto yang dianalisis TOPSID"/></div>}<div className="ts-loader"/><strong>{stage}</strong><div className="ts-progress"><span style={{width:`${progress}%`}}/></div></div></section>}

    {step==="results"&&profile&&<section className="ts-page"><div className="ts-wrap"><div className="ts-label">STEP 03 · HASIL ANALISIS</div><h1 className="ts-page-title">Ini karakter rambutmu,<br/><span className="ts-blue">menurut TOPSID.</span></h1><div className="ts-chips">
      <span className="ts-chip">Wajah <strong>{label(profile.face_shape)}</strong></span><span className="ts-chip">Tipe <strong>{label(profile.hair_type)}</strong></span><span className="ts-chip">Tekstur <strong>{label(profile.hair_texture)}</strong></span><span className="ts-chip">Ketebalan <strong>{label(profile.density)}</strong></span><span className="ts-chip">Panjang <strong>{label(profile.length)}</strong></span><span className="ts-chip">Confidence <strong>{profile.confidence}%</strong></span>
    </div><div className="ts-results-head"><div className="ts-label">STEP 04 · REKOMENDASI</div><h2 className="ts-recommend-title">3 model yang<br/><span className="ts-blue">paling cocok.</span></h2></div>
    <div className="ts-recommendations">{recs.map((m,i)=><article key={`${m.id}-${i}`} className="ts-recommendation"><div className="ts-rec-media"><ReferenceVisual model={m}/></div><div className="ts-rec-content"><div className="ts-label">{String(i+1).padStart(2,"0")} · {m.category}</div><h3>{m.name}</h3><div className="ts-score">{m.score}% cocok</div><ul className="ts-reasons">{(m.reasons.length?m.reasons:[m.description]).slice(0,3).map((r,j)=><li key={j}>✓ {r}</li>)}</ul><button className="ts-outline" onClick={()=>{setSelected(m);setStep("preview");window.scrollTo({top:0,behavior:"smooth"})}}>Lihat model →</button></div></article>)}</div></div></section>}

    {step==="preview"&&selected&&<section className="ts-page"><div className="ts-wrap"><button className="ts-back" onClick={()=>setStep(recs.length?"results":"home")}>← Kembali</button><div className="ts-label">STEP 05 · PREVIEW</div><h1 className="ts-page-title">Ini referensi<br/><span className="ts-blue">{selected.name}.</span></h1>
      <div className="ts-preview-grid"><div className="ts-preview-main"><ReferenceVisual model={selected} large/><div className="ts-preview-copy"><div className="ts-label">{selected.category}</div><h2>{selected.name}</h2><p className="ts-muted">{selected.description}</p><div className="ts-detail"><strong>Catatan potongan untuk barber</strong><span>{selected.cut}</span></div><button className="ts-cta" onClick={()=>startFitCheck(selected)}>Cek model ini di wajahku →</button></div></div><aside className="ts-side-ref"><h3>Referensi TOPSID</h3><ReferenceVisual model={selected}/><p>Gunakan referensi ini saat menjelaskan model yang diinginkan kepada barber.</p><button className="ts-secondary" onClick={()=>setStep(recs.length?"results":"home")}>Pilih model lain</button></aside></div>
    </div></section>}

    {step==="fit"&&fit&&<section className="ts-page"><div className="ts-wrap"><button className="ts-back" onClick={()=>setStep("preview")}>← Kembali</button><div className="ts-label">FIT CHECK · HASIL</div><h1 className="ts-page-title">Cocok nggak<br/><span className="ts-blue">buat kamu?</span></h1>
      <div className="ts-fit"><div className="ts-fit-card"><ReferenceVisual model={fit.model} large/><div className="ts-preview-copy"><div className="ts-label">{fit.model.category}</div><h2>{fit.model.name}</h2><div className="ts-fit-score">{fit.score}%</div><div className="ts-fit-good">{fit.score>=75?"Kecocokan tinggi":fit.score>=55?"Masih cocok dengan penyesuaian":"Kurang ideal, TOPSID sarankan alternatif."}</div><ul className="ts-fit-list">{fit.reasons.map((r,i)=><li key={i}>{r}</li>)}</ul>{fit.adjustments.length>0&&<div className="ts-barber"><strong>Penyesuaian untuk barber</strong>{fit.adjustments.join(" ")}</div>}<button className="ts-cta" onClick={()=>setStep("preview")}>Lihat referensi & barber brief →</button></div></div><div className="ts-fit-card"><h3>Hasil analisis foto</h3><div className="ts-chips"><span className="ts-chip">Wajah <strong>{label(fit.profile.face_shape)}</strong></span><span className="ts-chip">Tipe <strong>{label(fit.profile.hair_type)}</strong></span><span className="ts-chip">Tekstur <strong>{label(fit.profile.hair_texture)}</strong></span><span className="ts-chip">Ketebalan <strong>{label(fit.profile.density)}</strong></span><span className="ts-chip">Panjang <strong>{label(fit.profile.length)}</strong></span></div><p className="ts-muted">Fit score adalah estimasi kecocokan berdasarkan karakter yang terlihat pada foto, bukan jaminan hasil potongan.</p><button className="ts-secondary" onClick={reset}>Selesai</button></div></div>
    </div></section>}
  </main>;
}

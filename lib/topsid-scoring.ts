export type UserHairProfile = {
  face_shape?: string | null;
  hair_type?: string | null;
  hair_texture?: string | null;
  density?: string | null;
  length?: string | null;
  maintenance_level?: string | null;
};

export type HairstyleForScoring = {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  barber_note?: string | null;
  face_shapes?: string[] | null;
  hair_types?: string[] | null;
  hair_textures?: string[] | null;
  densities?: string[] | null;
  lengths?: string[] | null;
  maintenance_level?: string | null;
  collection_order?: number | null;
  reference_image_url?: string | null;
};

export type ScoredHairstyle = HairstyleForScoring & {
  score: number;
  matched: string[];
  reasons: string[];
};

const WEIGHTS = {
  face_shape: 35,
  hair_type: 20,
  hair_texture: 15,
  density: 10,
  length: 10,
  maintenance_level: 10,
} as const;

const LABELS: Record<keyof typeof WEIGHTS, string> = {
  face_shape: "bentuk wajah",
  hair_type: "tipe rambut",
  hair_texture: "tekstur rambut",
  density: "ketebalan rambut",
  length: "panjang rambut",
  maintenance_level: "kebutuhan perawatan",
};

function normalize(v?: string | null) {
  return String(v ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function pretty(v?: string | null) {
  if (!v || normalize(v) === "unknown") return "";
  return normalize(v).split(" ").map(x => x.charAt(0).toUpperCase()+x.slice(1)).join(" ");
}

function aliases(v?: string | null) {
  const n = normalize(v);
  const map: Record<string,string[]> = {
    round:["round","bulat"], square:["square","kotak"],
    oval:["oval"], heart:["heart"], diamond:["diamond"],
    straight:["straight","lurus"], wavy:["wavy","bergelombang"], curly:["curly","keriting","ikal"], coily:["coily"],
    fine:["fine","halus"], medium:["medium","sedang"], coarse:["coarse","kasar"],
    thin:["thin","tipis"], thick:["thick","tebal"], short:["short","pendek"], long:["long","panjang","lonjong"],
    "low maintenance":["low maintenance","rendah","mudah"],
    "medium maintenance":["medium maintenance","medium","sedang"],
    "high maintenance":["high maintenance","tinggi"],
  };
  return map[n] ?? [n];
}

function matches(values: string[]|null|undefined, target?: string|null) {
  if (!target || normalize(target)==="unknown" || !values?.length) return false;
  const wanted=aliases(target);
  return values.some(v=>{
    const c=normalize(v);
    return wanted.some(w=>c===w || c.includes(w) || w.includes(c));
  });
}

function factor(profileValue:string|null|undefined, styleValues:string[]|null|undefined, weight:number, key:keyof typeof WEIGHTS) {
  if (!profileValue || normalize(profileValue)==="unknown" || !styleValues?.length) return {points:0,matched:false,reason:""};
  const ok=matches(styleValues,profileValue);
  return {points:ok?weight:0,matched:ok,reason:ok?`${LABELS[key]} ${pretty(profileValue)} cocok.`:""};
}

export function scoreHairstyle(profile:UserHairProfile, style:HairstyleForScoring):ScoredHairstyle {
  let score=0; const matched:string[]=[]; const reasons:string[]=[];
  const factors:Array<[keyof typeof WEIGHTS,string|null|undefined,string[]|null|undefined]>=[
    ["face_shape",profile.face_shape,style.face_shapes],
    ["hair_type",profile.hair_type,style.hair_types],
    ["hair_texture",profile.hair_texture,style.hair_textures],
    ["density",profile.density,style.densities],
    ["length",profile.length,style.lengths],
    ["maintenance_level",profile.maintenance_level,style.maintenance_level?[style.maintenance_level]:null],
  ];
  for(const [key,pv,sv] of factors){const r=factor(pv,sv,WEIGHTS[key],key);if(r.matched){score+=r.points;matched.push(key);reasons.push(r.reason);}}
  return {...style,score:Math.min(100,Math.round(score)),matched,reasons};
}

export function rankHairstyles(profile:UserHairProfile,styles:HairstyleForScoring[],limit=3) {
  const safe=Math.min(Math.max(Number.isFinite(limit)?limit:3,1),9);
  return styles.map(s=>scoreHairstyle(profile,s)).sort((a,b)=>{
    if(b.score!==a.score)return b.score-a.score;
    if((b.matched?.length??0)!==(a.matched?.length??0))return (b.matched?.length??0)-(a.matched?.length??0);
    return (a.collection_order??999)-(b.collection_order??999);
  }).slice(0,safe);
}

export function recommendationConfidence(profile:UserHairProfile,styles:ScoredHairstyle[]) {
  const fields=[profile.face_shape,profile.hair_type,profile.hair_texture,profile.density,profile.length].filter(v=>v&&normalize(v)!=="unknown").length;
  const top=styles[0]?.score??0, second=styles[1]?.score??0;
  const signal=Math.min(1,fields/5), separation=Math.min(1,Math.max(0,top-second)/25);
  return Math.max(0,Math.min(100,Math.round(top*.72+signal*18+separation*10)));
}

export function fitAdjustments(profile:UserHairProfile,style:HairstyleForScoring) {
  const out:string[]=[];
  if(profile.face_shape && !matches(style.face_shapes,profile.face_shape)) out.push("Sesuaikan volume samping/atas agar proporsi wajah tetap seimbang.");
  if(profile.hair_type && !matches(style.hair_types,profile.hair_type)) out.push("Barber dapat mengadaptasikan teknik potong mengikuti karakter rambutmu.");
  if(profile.hair_texture && !matches(style.hair_textures,profile.hair_texture)) out.push("Pertahankan tekstur alami dan jangan memaksakan bentuk referensi secara mentah.");
  if(profile.density && !matches(style.densities,profile.density)) out.push("Sesuaikan bobot rambut saat cutting agar hasil tetap proporsional.");
  return out;
}

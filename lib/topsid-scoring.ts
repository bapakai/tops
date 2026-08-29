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

function normalize(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function pretty(value?: string | null) {
  if (!value) return "";
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function aliases(value?: string | null) {
  const normalized = normalize(value);
  if (!normalized) return [];

  const map: Record<string, string[]> = {
    oval: ["oval"],
    round: ["round", "bulat"],
    square: ["square", "kotak"],
    long: ["long", "lonjong"],
    straight: ["straight", "lurus"],
    wavy: ["wavy", "bergelombang"],
    curly: ["curly", "keriting", "ikal"],
    thin: ["thin", "tipis"],
    medium: ["medium", "sedang"],
    thick: ["thick", "tebal"],
    short: ["short", "pendek"],
    "low maintenance": ["low maintenance", "rendah", "mudah"],
    "medium maintenance": ["medium maintenance", "medium", "sedang"],
    "high maintenance": ["high maintenance", "tinggi"],
  };

  return map[normalized] ?? [normalized];
}

function matches(values: string[] | null | undefined, target?: string | null) {
  if (!target || !values?.length) return false;
  const wanted = aliases(target);
  return values.some((value) => {
    const candidate = normalize(value);
    return wanted.includes(candidate) || wanted.some((item) => candidate.includes(item));
  });
}

function scoreFactor(
  profileValue: string | null | undefined,
  styleValues: string[] | null | undefined,
  weight: number,
  key: keyof typeof WEIGHTS
) {
  if (!profileValue) return { points: 0, matched: false, reason: "" };
  if (!styleValues?.length) return { points: 0, matched: false, reason: "" };

  const matched = matches(styleValues, profileValue);
  return {
    points: matched ? weight : 0,
    matched,
    reason: matched
      ? `${LABELS[key]} ${pretty(profileValue)} cocok.`
      : "",
  };
}

export function scoreHairstyle(
  profile: UserHairProfile,
  style: HairstyleForScoring
): ScoredHairstyle {
  let score = 0;
  const matched: string[] = [];
  const reasons: string[] = [];

  const factors: Array<[
    keyof typeof WEIGHTS,
    string | null | undefined,
    string[] | null | undefined
  ]> = [
    ["face_shape", profile.face_shape, style.face_shapes],
    ["hair_type", profile.hair_type, style.hair_types],
    ["hair_texture", profile.hair_texture, style.hair_textures],
    ["density", profile.density, style.densities],
    ["length", profile.length, style.lengths],
    ["maintenance_level", profile.maintenance_level, style.maintenance_level ? [style.maintenance_level] : null],
  ];

  for (const [key, profileValue, styleValues] of factors) {
    const result = scoreFactor(profileValue, styleValues, WEIGHTS[key], key);
    if (result.matched) {
      score += result.points;
      matched.push(key);
      reasons.push(result.reason);
    }
  }

  // Give a small deterministic tie-breaker to earlier curated collection items.
  // It never changes the main score.
  return {
    ...style,
    score: Math.min(100, Math.round(score)),
    matched,
    reasons,
  };
}

export function rankHairstyles(
  profile: UserHairProfile,
  styles: HairstyleForScoring[],
  limit = 3
): ScoredHairstyle[] {
  const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? limit : 3, 1), 9);

  return styles
    .map((style) => scoreHairstyle(profile, style))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.collection_order ?? 999) - (b.collection_order ?? 999);
    })
    .slice(0, safeLimit);
}

export function recommendationConfidence(
  profile: UserHairProfile,
  styles: ScoredHairstyle[]
) {
  const fields = [
    profile.face_shape,
    profile.hair_type,
    profile.hair_texture,
    profile.density,
    profile.length,
    profile.maintenance_level,
  ].filter(Boolean).length;

  const topScore = styles[0]?.score ?? 0;
  const secondScore = styles[1]?.score ?? 0;
  const signal = Math.min(1, fields / 6);
  const separation = Math.min(1, Math.max(0, topScore - secondScore) / 25);

  return Math.round((topScore * 0.7 + signal * 20 + separation * 10));
}

export type UserHairProfile = {
  face_shape?: string;
  hair_type?: string;
  hair_texture?: string;
  density?: string;
  length?: string;
  maintenance_level?: string;
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

function normalize(value?: string | null) {
  return String(value ?? "").trim().toLowerCase().replace(/[-_]/g, " ");
}

function matches(values: string[] | null | undefined, target?: string) {
  if (!target || !values?.length) return false;
  const wanted = normalize(target);
  return values.some((value) => normalize(value) === wanted);
}

function title(value?: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function scoreHairstyle(
  profile: UserHairProfile,
  style: HairstyleForScoring
): ScoredHairstyle {
  let score = 0;
  const matched: string[] = [];
  const reasons: string[] = [];

  if (matches(style.face_shapes, profile.face_shape)) {
    score += WEIGHTS.face_shape;
    matched.push("face_shape");
    reasons.push(`Bentuk wajah ${title(profile.face_shape)} cocok.`);
  }

  if (matches(style.hair_types, profile.hair_type)) {
    score += WEIGHTS.hair_type;
    matched.push("hair_type");
    reasons.push(`Tipe rambut ${title(profile.hair_type)} cocok.`);
  }

  if (matches(style.hair_textures, profile.hair_texture)) {
    score += WEIGHTS.hair_texture;
    matched.push("hair_texture");
    reasons.push(`Tekstur ${title(profile.hair_texture)} mendukung model ini.`);
  }

  if (matches(style.densities, profile.density)) {
    score += WEIGHTS.density;
    matched.push("density");
    reasons.push(`Ketebalan rambut ${title(profile.density)} sesuai.`);
  }

  if (matches(style.lengths, profile.length)) {
    score += WEIGHTS.length;
    matched.push("length");
    reasons.push(`Panjang rambut ${title(profile.length)} sesuai.`);
  }

  if (
    profile.maintenance_level &&
    normalize(style.maintenance_level) === normalize(profile.maintenance_level)
  ) {
    score += WEIGHTS.maintenance_level;
    matched.push("maintenance_level");
    reasons.push(
      `Perawatan sesuai preferensi ${title(profile.maintenance_level)}.`
    );
  }

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
  return styles
    .map((style) => scoreHairstyle(profile, style))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.collection_order ?? 999) - (b.collection_order ?? 999);
    })
    .slice(0, Math.max(1, Math.min(limit, 9)));
}

import Anthropic from "@anthropic-ai/sdk";

export type HairProfile = {
  face_shape: string | null;
  hair_type: string | null;
  hair_texture: string | null;
  density: string | null;
  length: string | null;
  confidence: number;
};

const MODEL = process.env.TOPSID_VISION_MODEL || process.env.ANTHROPIC_VISION_MODEL || "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `
You are TOPSID Vision, a conservative hairstyle-analysis assistant.

Analyze only visible characteristics in the supplied hair/face photo.
Do not identify the person. Do not infer age, ethnicity, health, attractiveness,
personality, or any other sensitive trait.

Return ONLY valid JSON:
{
  "face_shape": "oval|round|square|long|heart|diamond|unknown",
  "hair_type": "straight|wavy|curly|coily|unknown",
  "hair_texture": "fine|medium|coarse|unknown",
  "density": "thin|medium|thick|unknown",
  "length": "short|medium|long|unknown",
  "confidence": 0
}

Use unknown when evidence is insufficient. Confidence is 0-100.
`.trim();

function decodeImageData(input: unknown) {
  if (typeof input !== "string") return null;
  const marker = ";base64,";
  const i = input.indexOf(marker);
  if (i < 0 || !input.startsWith("data:")) return null;
  const mime = input.slice(5, i).toLowerCase();
  const data = input.slice(i + marker.length);
  if (!data) return null;
  if (mime === "image/jpeg" || mime === "image/jpg") return { mediaType: "image/jpeg" as const, data };
  if (mime === "image/png") return { mediaType: "image/png" as const, data };
  if (mime === "image/webp") return { mediaType: "image/webp" as const, data };
  return null;
}

function parseResponse(text: string): HairProfile {
  let cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  const parsed = JSON.parse(cleaned);
  const allowed = {
    face_shape: ["oval","round","square","long","heart","diamond","unknown"],
    hair_type: ["straight","wavy","curly","coily","unknown"],
    hair_texture: ["fine","medium","coarse","unknown"],
    density: ["thin","medium","thick","unknown"],
    length: ["short","medium","long","unknown"],
  } as const;
  const pick = (key: keyof typeof allowed) => {
    const v = String(parsed?.[key] || "unknown").toLowerCase();
    return (allowed[key] as readonly string[]).includes(v) ? v : "unknown";
  };
  const confidence = Number(parsed?.confidence ?? 0);
  return {
    face_shape: pick("face_shape"),
    hair_type: pick("hair_type"),
    hair_texture: pick("hair_texture"),
    density: pick("density"),
    length: pick("length"),
    confidence: Math.max(0, Math.min(100, Number.isFinite(confidence) ? confidence : 0)),
  };
}

export async function analyzeHairPhoto(input: unknown) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("TOPSID Vision belum dikonfigurasi di Vercel.");
  const image = decodeImageData(input);
  if (!image) throw new Error("Foto tidak valid. Gunakan JPG, PNG, atau WebP.");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 250,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
        { type: "text", text: "Analyze this photo for TOPSID. Return the required JSON only." }
      ]
    }]
  });
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text).join("\n");
  return { profile: parseResponse(text), model: MODEL };
}

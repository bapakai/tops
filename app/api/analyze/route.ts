import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const MODEL =
  process.env.TOPSID_VISION_MODEL ||
  process.env.ANTHROPIC_VISION_MODEL ||
  "claude-haiku-4-5-20251001";

type HairProfile = {
  face_shape: string | null;
  hair_type: string | null;
  hair_texture: string | null;
  density: string | null;
  length: string | null;
  confidence: number;
};

const SYSTEM_PROMPT = `
You are TOPSID Vision, a conservative hairstyle-analysis assistant.

Analyze only visible characteristics in the supplied hair/face photo.

Do not identify the person.
Do not infer age, ethnicity, health, attractiveness, personality,
or any other sensitive trait.

Return ONLY valid JSON with exactly these keys:

{
  "face_shape": "oval|round|square|long|heart|diamond|unknown",
  "hair_type": "straight|wavy|curly|coily|unknown",
  "hair_texture": "fine|medium|coarse|unknown",
  "density": "thin|medium|thick|unknown",
  "length": "short|medium|long|unknown",
  "confidence": 0
}

Confidence must be a number from 0 to 100.

Use "unknown" when the photo does not provide enough evidence.
Never invent a value just to complete the JSON.
`.trim();

function decodeImageData(input: unknown) {
  if (typeof input !== "string") return null;

  const marker = ";base64,";
  const markerIndex = input.indexOf(marker);
  if (markerIndex === -1) return null;

  const header = input.substring(0, markerIndex);
  const data = input.substring(markerIndex + marker.length);
  if (!data || !header.startsWith("data:")) return null;

  const mime = header.substring("data:".length).toLowerCase();

  let mediaType: "image/jpeg" | "image/png" | "image/webp";

  if (mime === "image/jpeg" || mime === "image/jpg") {
    mediaType = "image/jpeg";
  } else if (mime === "image/png") {
    mediaType = "image/png";
  } else if (mime === "image/webp") {
    mediaType = "image/webp";
  } else {
    return null;
  }

  return { mediaType, data };
}

function parseVisionResponse(text: string): HairProfile {
  let cleaned = text.trim();

  if (cleaned.startsWith("```json")) cleaned = cleaned.substring(7);
  if (cleaned.startsWith("```")) cleaned = cleaned.substring(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.substring(0, cleaned.length - 3);

  const parsed = JSON.parse(cleaned.trim());

  const allowed = {
    face_shape: ["oval", "round", "square", "long", "heart", "diamond", "unknown"],
    hair_type: ["straight", "wavy", "curly", "coily", "unknown"],
    hair_texture: ["fine", "medium", "coarse", "unknown"],
    density: ["thin", "medium", "thick", "unknown"],
    length: ["short", "medium", "long", "unknown"],
  };

  const value = (key: keyof typeof allowed) => {
    const normalized = String(parsed?.[key] || "unknown").toLowerCase();
    return allowed[key].includes(normalized) ? normalized : "unknown";
  };

  const confidence = Number(parsed?.confidence ?? 0);

  return {
    face_shape: value("face_shape"),
    hair_type: value("hair_type"),
    hair_texture: value("hair_texture"),
    density: value("density"),
    length: value("length"),
    confidence: Math.min(100, Math.max(0, Number.isFinite(confidence) ? confidence : 0)),
  };
}

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "TOPSID Vision belum dikonfigurasi di Vercel." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const image = decodeImageData(body?.image);

    if (!image) {
      return NextResponse.json(
        { error: "Foto tidak valid. Gunakan JPG, PNG, atau WebP." },
        { status: 400 }
      );
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image.mediaType,
                data: image.data,
              },
            },
            {
              type: "text",
              text: "Analyze this photo for TOPSID and return the required JSON only.",
            },
          ],
        },
      ],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return NextResponse.json({
      data: parseVisionResponse(text),
      model: MODEL,
      engine: "claude-vision",
    });
  } catch (error) {
    console.error("TOPSID Vision error:", error);

    return NextResponse.json(
      { error: "Analisis foto belum berhasil. Silakan coba foto lain." },
      { status: 502 }
    );
  }
}

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const MODEL =
  process.env.TOPSID_VISION_MODEL ||
  process.env.ANTHROPIC_VISION_MODEL ||
  "claude-haiku-4-5-20251001";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type HairProfile = {
  face_shape: string | null;
  hair_type: string | null;
  hair_texture: string | null;
  density: string | null;
  length: string | null;
};

const SYSTEM_PROMPT = `
You are TOPSID Vision, a conservative hairstyle-analysis assistant.

Analyze only visible characteristics in the supplied hair/face photo.
Do not identify the person. Do not infer age, ethnicity, health, attractiveness,
personality, or other sensitive traits.

Return ONLY valid JSON with exactly these keys:
{
  "face_shape": "oval|round|square|long|heart|diamond|unknown",
  "hair_type": "straight|wavy|curly|coily|unknown",
  "hair_texture": "fine|medium|coarse|unknown",
  "density": "thin|medium|thick|unknown",
  "length": "short|medium|long|unknown",
  "confidence": 0-100
}

Use "unknown" when the photo does not provide enough evidence.
Never invent a value just to complete the JSON.
`.trim();

function cleanBase64(input: unknown) {
  if (typeof input !== "string") return null;
  const match = input.match(/^data:(image\\/(?:jpeg|jpg|png|webp));base64,(.+)$/i);
  if (!match) return null;

  return {
    mediaType: match[1].toLowerCase().replace("jpg", "jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/webp",
    data: match[2],
  };
}

function parseJson(text: string): HairProfile & { confidence: number } {
  const cleaned = text
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  const allowed = {
    face_shape: ["oval","round","square","long","heart","diamond","unknown"],
    hair_type: ["straight","wavy","curly","coily","unknown"],
    hair_texture: ["fine","medium","coarse","unknown"],
    density: ["thin","medium","thick","unknown"],
    length: ["short","medium","long","unknown"],
  };

  const value = (key: keyof typeof allowed) => {
    const candidate = String(parsed?.[key] ?? "unknown").toLowerCase();
    return allowed[key].includes(candidate) ? candidate : "unknown";
  };

  return {
    face_shape: value("face_shape"),
    hair_type: value("hair_type"),
    hair_texture: value("hair_texture"),
    density: value("density"),
    length: value("length"),
    confidence: Math.min(100, Math.max(0, Number(parsed?.confidence) || 0)),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const image = cleanBase64(body?.image);

    if (!image) {
      return NextResponse.json(
        { error: "Foto tidak valid. Gunakan JPG, PNG, atau WebP." },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "TOPSID Vision belum dikonfigurasi di Vercel." },
        { status: 500 }
      );
    }

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
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const profile = parseJson(text);

    return NextResponse.json({
      data: profile,
      model: MODEL,
      engine: "claude-vision",
    });
  } catch (error) {
    console.error("TOPSID Vision error:", error);

    return NextResponse.json(
      {
        error: "Analisis foto belum berhasil. Silakan coba foto lain.",
      },
      { status: 502 }
    );
  }
}

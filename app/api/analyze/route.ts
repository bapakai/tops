import { NextResponse } from "next/server";
import { analyzeHairPhoto } from "../../../lib/topsid-vision";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await analyzeHairPhoto(body?.image);
    return NextResponse.json({ data: result.profile, model: result.model, engine: "topsid-vision" });
  } catch (error) {
    console.error("TOPSID Vision error:", error);
    const message = error instanceof Error ? error.message : "Analisis foto belum berhasil.";
    const status = message.includes("tidak valid") ? 400 : message.includes("belum dikonfigurasi") ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

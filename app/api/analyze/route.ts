import { NextResponse } from "next/server";
import { analyzeHairPhoto } from "../../../lib/topsid-vision";
import { checkAndIncrementUsage } from "../../../lib/topsid-usage";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const deviceId = typeof body?.device_id === "string" ? body.device_id : null;
    const usage = await checkAndIncrementUsage(deviceId);
    if (!usage.allowed) {
      return NextResponse.json(
        { error: `Batas analisis gratis hari ini tercapai (${usage.count}/${usage.limit}). Coba lagi besok ya.` },
        { status: 429 }
      );
    }
    const result = await analyzeHairPhoto(body?.image);
    return NextResponse.json({ data: result.profile, model: result.model, engine: "topsid-vision" });
  } catch (error) {
    console.error("TOPSID Vision error:", error);
    const message = error instanceof Error ? error.message : "Analisis foto belum berhasil.";
    const status = message.includes("tidak valid") ? 400 : message.includes("belum dikonfigurasi") ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

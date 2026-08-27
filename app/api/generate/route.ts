import { NextResponse } from "next/server";

export async function POST() {
  // Placeholder endpoint.
  // Connect this to an image generation/editing provider later.
  return NextResponse.json({
    status: "mock",
    message: "Image generation belum dihubungkan pada MVP starter."
  });
}
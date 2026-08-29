import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { data: [], error: "Supabase belum dikonfigurasi." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const requestedLimit = Number(searchParams.get("limit") ?? "9");
  const limit = Math.min(
    Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 9, 1),
    30
  );

  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/topsid_hairstyles`);
    url.searchParams.set(
      "select",
      "id,name,category,description,barber_note,face_shapes,hair_types,hair_textures,densities,lengths,maintenance_level,collection_order"
    );
    url.searchParams.set("is_active", "eq.true");
    url.searchParams.set("order", "collection_order.asc");
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("TOPSID hairstyles Supabase error:", await response.text());
      return NextResponse.json(
        { data: [], error: "Gagal mengambil TOP'S Collection." },
        { status: 502 }
      );
    }

    return NextResponse.json({ data: await response.json() });
  } catch (error) {
    console.error("TOPSID hairstyles route error:", error);
    return NextResponse.json(
      { data: [], error: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}

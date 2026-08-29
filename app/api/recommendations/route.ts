import { NextResponse } from "next/server";
import { rankHairstyles, type UserHairProfile } from "@/lib/topsid-scoring";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ data: [], error: "Supabase belum dikonfigurasi." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const profile = (body?.profile ?? {}) as UserHairProfile;
    const requestedLimit = Number(body?.limit ?? 3);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 3, 1), 9);

    const url = new URL(`${SUPABASE_URL}/rest/v1/topsid_hairstyles`);
    url.searchParams.set(
      "select",
      "id,name,category,description,barber_note,face_shapes,hair_types,hair_textures,densities,lengths,maintenance_level,collection_order"
    );
    url.searchParams.set("is_active", "eq.true");
    url.searchParams.set("order", "collection_order.asc");
    url.searchParams.set("limit", "30");

    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("TOPSID recommendation Supabase error:", await response.text());
      return NextResponse.json({ data: [], error: "Gagal mengambil data model rambut." }, { status: 502 });
    }

    const styles = await response.json();
    return NextResponse.json({
      data: rankHairstyles(profile, styles, limit),
      profile,
      engine: {
        version: "v1",
        weights: { face_shape: 35, hair_type: 20, hair_texture: 15, density: 10, length: 10, maintenance_level: 10 }
      }
    });
  } catch (error) {
    console.error("TOPSID recommendation route error:", error);
    return NextResponse.json({ data: [], error: "Format request tidak valid." }, { status: 400 });
  }
}

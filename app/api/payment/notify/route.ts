import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  try {
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey || !SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ error: "Webhook belum dikonfigurasi." }, { status: 500 });
    }

    const body = await request.json();
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status, custom_field1, custom_field2, custom_field3 } = body || {};

    // Verify Midtrans signature: sha512(order_id + status_code + gross_amount + server_key)
    const expected = crypto
      .createHash("sha512")
      .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
      .digest("hex");
    if (expected !== signature_key) {
      return NextResponse.json({ error: "Signature tidak valid." }, { status: 403 });
    }

    const success = (transaction_status === "capture" || transaction_status === "settlement") && (!fraud_status || fraud_status === "accept");
    if (!success) {
      return NextResponse.json({ status: "ignored", transaction_status });
    }

    const deviceId = typeof custom_field1 === "string" ? custom_field1 : null;
    const whatsapp = typeof custom_field2 === "string" ? custom_field2 : null;
    const credits = Number(custom_field3) || 15;
    if (!deviceId) return NextResponse.json({ error: "device tidak ditemukan di transaksi." }, { status: 400 });

    // Read current balance/expiry so we ADD credits and extend expiry rather than overwrite
    const getRes = await fetch(`${SUPABASE_URL}/rest/v1/topsid_credits?device_id=eq.${encodeURIComponent(deviceId)}&select=credit_balance,expires_at`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      cache: "no-store",
    });
    const rows = await getRes.json();
    const existing = Array.isArray(rows) ? rows[0] : null;
    const now = Date.now();
    const currentExpiry = existing?.expires_at ? new Date(existing.expires_at).getTime() : 0;
    const newExpiry = new Date(Math.max(currentExpiry, now) + 30 * 24 * 60 * 60 * 1000).toISOString();
    const newBalance = (existing?.credit_balance || 0) + credits;

    await fetch(`${SUPABASE_URL}/rest/v1/topsid_credits`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        device_id: deviceId,
        whatsapp_number: whatsapp,
        credit_balance: newBalance,
        expires_at: newExpiry,
        updated_at: new Date().toISOString(),
      }),
    });

    return NextResponse.json({ status: "credited", device_id: deviceId, credits: newBalance });
  } catch (error) {
    console.error("TOPSID payment webhook error:", error);
    return NextResponse.json({ error: "Notifikasi tidak valid." }, { status: 400 });
  }
}

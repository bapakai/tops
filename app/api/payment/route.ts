import { NextResponse } from "next/server";

export const runtime = "nodejs";

const IS_PROD = process.env.MIDTRANS_IS_PRODUCTION === "true";
const SNAP_URL = IS_PROD
  ? "https://app.midtrans.com/snap/v1/transactions"
  : "https://app.sandbox.midtrans.com/snap/v1/transactions";

const CREDITS_PER_TOPUP = 15;
const PRICE_IDR = 9000;

export async function POST(request: Request) {
  try {
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      return NextResponse.json({ error: "Pembayaran belum dikonfigurasi." }, { status: 500 });
    }

    const body = await request.json();
    const deviceId = typeof body?.device_id === "string" ? body.device_id.trim() : "";
    const whatsapp = typeof body?.whatsapp_number === "string" ? body.whatsapp_number.trim() : "";

    if (!deviceId) return NextResponse.json({ error: "Device tidak dikenali." }, { status: 400 });
    if (!/^[0-9+]{8,15}$/.test(whatsapp)) {
      return NextResponse.json({ error: "Nomor WhatsApp tidak valid." }, { status: 400 });
    }

    const orderId = `topsid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const auth = Buffer.from(`${serverKey}:`).toString("base64");

    const res = await fetch(SNAP_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: PRICE_IDR },
        item_details: [{ id: "topup-15", price: PRICE_IDR, quantity: 1, name: "TOPSID 15 Kredit Analisis" }],
        customer_details: { phone: whatsapp },
        enabled_payments: ["qris", "gopay", "shopeepay"],
        custom_field1: deviceId,
        custom_field2: whatsapp,
        custom_field3: String(CREDITS_PER_TOPUP),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data?.error_messages?.[0] || "Gagal membuat transaksi." }, { status: 502 });
    }

    return NextResponse.json({ redirect_url: data.redirect_url, order_id: orderId });
  } catch (error) {
    console.error("TOPSID payment error:", error);
    return NextResponse.json({ error: "Request pembayaran tidak valid." }, { status: 400 });
  }
}

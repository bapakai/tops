# potram.id — MVP Starter

Micro-SaaS starter untuk konsep:

> **Cek dulu. Baru potong.**

Flow saat ini:

1. Beranda
2. Upload foto
3. Simulasi analisis
4. 3 rekomendasi model
5. Preview demo
6. Brief yang bisa ditunjukkan ke barber

## Jalankan lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Deploy ke Vercel

1. Upload folder ini ke GitHub.
2. Import repository ke Vercel.
3. Framework: Next.js.
4. Tidak ada environment variable yang wajib untuk demo ini.
5. Deploy.

## Catatan penting

Versi ini sengaja **belum memakai API AI berbayar**. UI dan user flow dibuat dulu supaya bisa dites.

Tahap berikutnya:

- Supabase Storage untuk foto
- Vision AI untuk analisis wajah/rambut
- Recommendation Engine berbasis style matrix
- Image Generation/Edit API untuk preview rambut
- Usage/credit system
- Midtrans untuk pembayaran

Jangan menaruh API key di client/browser. Semua secret API harus berada di environment variable Vercel dan dipanggil dari server route.

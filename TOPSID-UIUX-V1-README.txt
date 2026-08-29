TOPSID UI/UX V1 — IMPLEMENTATION PACKAGE

TUJUAN
Replace the current app/topsid.tsx with the included version.
The existing /api/analyze, /api/recommendations and /api/hairstyles endpoints are preserved.

USER JOURNEY
1. CARI
2. REKAM
3. ANALISIS
4. PILIH
5. PREVIEW / UNTUK BARBER

TOP'S COLLECTION
Exactly 9 primary models are surfaced in the main collection:
Two Block, Low Fade, Textured Crop, Comma Hair, French Crop,
Middle Part, Crew Cut, Ivy League, Short Quiff.

REFERENCE IMAGES
The package includes nine consistent AI-generated visual references under:
public/refs/

IMPORTANT
The reference images are V1 visual references based on the approved TOPSID collection-board direction.
They are intentionally local so the UI does not depend on third-party hotlink URLs.
They can later be replaced one-for-one with the final standardized AI reference set without changing the UI code.

UPLOAD
1. Upload/replace:
   app/topsid.tsx
2. Upload the whole directory:
   public/refs/
3. Commit to main.
4. Let Vercel deploy.
5. Open the latest deployment and test:
   Home → Cari Tahu Sekarang → Camera/Galeri → Analisis AI → 3 Recommendations → Lihat model → Tunjukkan ke barber.

NO ENV CHANGES REQUIRED
This UI package uses the API assets that already exist.
Do not change BapakAI environment variables.

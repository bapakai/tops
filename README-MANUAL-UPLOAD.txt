TOPSID V2 — ARCHITECTURE-FIRST UPDATE

Replace these files in bapakai/tops:
- app/page.tsx
- app/layout.tsx

The existing TOPSID backend routes in the repo are intentionally preserved:
- app/api/analyze/route.ts
- app/api/recommendations/route.ts
- app/api/fit-check/route.ts
- app/api/hairstyles/route.ts
- lib/topsid-vision.ts
- lib/topsid-scoring.ts

What this UI update changes:
1. Home now visibly follows the TOPSID architecture: TOP'S COLLECTION + unrestricted AI engine + value output.
2. Home displays 15 active discovery models from Supabase.
3. Collection rotates deterministically every 14 days as a discovery layer.
4. Recommendation results show profile, confidence, 3 best matches, reasons, barber brief and reference visual.
5. Preview now leads into Fit Check.
6. Fit Check returns score, reasons and adjustment suggestions.
7. Mobile layout is redesigned so the architecture does not disappear below the fold.
8. No package.json dependency change required.

IMPORTANT:
- Do not delete public/refs.
- Do not delete existing API routes.
- After upload, wait for Vercel to deploy and test the production/preview URL.

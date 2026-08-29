# TOPSID UI/UX FIX v1

Replace these files in the existing `bapakai/tops` repo:
- `app/topsid.tsx`
- `app/api/hairstyles/route.ts`
- `app/api/recommendations/route.ts`

Supabase migration already applied to project `BapakAI`:
- adds nullable `public.topsid_hairstyles.reference_image_url`
- seeds reference URLs for the currently covered styles

UI/UX changes:
- Home is simpler and CTA-led.
- Large instructional cards are replaced by a compact 3-step journey.
- Capture is honestly one-photo-first; no false multi-angle recording claim.
- Analysis shows the user's captured photo while AI works.
- Results show visual reference photos for recommendations.
- Each recommendation is photo-first: image, rank, match score, reason, action.
- Reference screen gives a large photo plus barber notes.
- Barber screen carries the same reference image and copyable cut instructions.
- TOP'S Collection is visual and mobile-first.
- Header/menu and step tracker are cleaner on mobile.

Note: the current prototype references third-party image URLs. For production, replace them with images hosted/owned by TOPSID (preferably Supabase Storage/CDN) and keep the URLs in `reference_image_url`.

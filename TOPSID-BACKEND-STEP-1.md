# TOPSID Backend Step 1

This package connects TOP'S Collection to Supabase.

## Required Vercel environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

`SUPABASE_SERVICE_ROLE_KEY` is used only in the server route and must never be exposed to client-side code.

## Behavior
- Home requests `/api/hairstyles?limit=30`.
- Active hairstyles are returned in `collection_order`.
- The Home still shows exactly 9 models.
- If Supabase/API is unavailable, the existing local hairstyle array remains as a fallback.
- No Vision AI, authentication, payment, or virtual try-on is included in this step.

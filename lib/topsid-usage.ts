const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_LIMIT = Number(process.env.TOPSID_DAILY_FREE_LIMIT || 2);

export type UsageCheck = {
  allowed: boolean;
  count: number;
  limit: number;
  source: "credit" | "free";
  creditsLeft: number;
};

/**
 * Atomic gate against public.topsid_consume_usage: spends a paid credit
 * first (public.topsid_credits) if one is available and not expired, else
 * falls back to the free daily quota (public.topsid_usage). Must run BEFORE
 * any Anthropic Vision call so a device over its limit never reaches the
 * paid API — this is what actually saves credits, not a client-side check.
 *
 * Fails OPEN (allowed:true) if device_id is missing or Supabase env vars are
 * not configured, so a misconfiguration never blocks real users — it only
 * means usage won't be limited until the config/device id issue is fixed.
 */
export async function checkAndIncrementUsage(
  deviceId: string | null | undefined,
  limit: number = DEFAULT_LIMIT
): Promise<UsageCheck> {
  if (!deviceId || !URL || !KEY) return { allowed: true, count: 0, limit, source: "free", creditsLeft: 0 };
  try {
    const res = await fetch(`${URL}/rest/v1/rpc/topsid_consume_usage`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_device_id: deviceId, p_daily_limit: limit }),
      cache: "no-store",
    });
    if (!res.ok) return { allowed: true, count: 0, limit, source: "free", creditsLeft: 0 };
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      allowed: Boolean(row?.allowed ?? true),
      count: Number(row?.current_count ?? 0),
      limit: Number(row?.limit_value ?? limit),
      source: row?.source === "credit" ? "credit" : "free",
      creditsLeft: Number(row?.credits_left ?? 0),
    };
  } catch {
    return { allowed: true, count: 0, limit, source: "free", creditsLeft: 0 };
  }
}

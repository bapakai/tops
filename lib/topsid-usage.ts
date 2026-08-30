const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_LIMIT = Number(process.env.TOPSID_DAILY_FREE_LIMIT || 5);

export type UsageCheck = { allowed: boolean; count: number; limit: number };

/**
 * Atomic check-and-increment against public.topsid_usage via a single Postgres
 * function call (topsid_check_and_increment_usage). Must run BEFORE any
 * Anthropic Vision call so a device over its daily limit never reaches the
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
  if (!deviceId || !URL || !KEY) return { allowed: true, count: 0, limit };
  try {
    const res = await fetch(`${URL}/rest/v1/rpc/topsid_check_and_increment_usage`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_device_id: deviceId, p_limit: limit }),
      cache: "no-store",
    });
    if (!res.ok) return { allowed: true, count: 0, limit };
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      allowed: Boolean(row?.allowed ?? true),
      count: Number(row?.current_count ?? 0),
      limit: Number(row?.limit_value ?? limit),
    };
  } catch {
    return { allowed: true, count: 0, limit };
  }
}

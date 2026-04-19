import { sql } from './db';

const COOLDOWN_MS = 2 * 60 * 1000;
const DAILY_MAX = 5;

export async function checkRateLimit(ipHash: string): Promise<{
  ok: boolean;
  reason?: 'cooldown' | 'daily';
}> {
  // We count BOTH 'live' and 'rejected' — a rejected submission still counts
  // against the rate limit, otherwise spammers get unlimited tries.
  const rows = await sql`
    select created_at from moments
    where ip_hash = ${ipHash}
    and created_at > now() - interval '24 hours'
    order by created_at desc
    limit 10
  ` as any[];

  if (rows.length >= DAILY_MAX) {
    return { ok: false, reason: 'daily' };
  }
  if (rows.length > 0) {
    const last = new Date(rows[0].created_at).getTime();
    if (Date.now() - last < COOLDOWN_MS) {
      return { ok: false, reason: 'cooldown' };
    }
  }
  return { ok: true };
}

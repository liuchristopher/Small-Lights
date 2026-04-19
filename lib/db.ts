import { Pool } from 'pg';
import { customAlphabet } from 'nanoid';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL not set');
}

// Singleton pool across hot-reloads in dev
const globalForPool = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPool.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== 'production') globalForPool.pgPool = pool;

async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

// 10-char short ids, no ambiguous chars (0, o, 1, l, i)
const genShortId = customAlphabet('abcdefghjkmnpqrstuvwxyz23456789', 10);

export async function getRandomLiveMoment(
  excludeShortIds: string[] = []
): Promise<{ id: string; short_id: string; text: string } | null> {
  const rows = await query<any>(
    `select id, short_id, text from moments
     where status = 'live' and not (short_id = any($1::text[]))
     order by random() limit 1`,
    [excludeShortIds]
  );
  return rows[0] ?? null;
}

export async function getMomentByShortId(shortId: string) {
  const rows = await query<any>(
    `select id, short_id, text, status, flag_count, created_at
     from moments where short_id = $1`,
    [shortId]
  );
  return rows[0] ?? null;
}

export async function countLiveMoments(): Promise<number> {
  const rows = await query<{ n: number }>(
    `select count(*)::int as n from moments where status = 'live'`
  );
  return rows[0]?.n ?? 0;
}

export async function insertMoment(params: {
  text: string;
  status: 'live' | 'rejected';
  moderationDecision: string;
  moderationReason: string;
  ipHash: string;
}) {
  const short_id = genShortId();
  const rows = await query<any>(
    `insert into moments (short_id, text, status, moderation_decision, moderation_reason, ip_hash)
     values ($1, $2, $3, $4, $5, $6)
     returning id, short_id, text, status`,
    [short_id, params.text, params.status, params.moderationDecision, params.moderationReason, params.ipHash]
  );
  return rows[0];
}

export async function insertFlag(momentId: string, flaggerHash: string): Promise<boolean> {
  try {
    await query(
      `insert into flags (moment_id, flagger_hash) values ($1, $2)`,
      [momentId, flaggerHash]
    );
    return true;
  } catch {
    return false;
  }
}

export async function getFlaggedOrHiddenMoments(limit = 100) {
  return query<any>(
    `select id, short_id, text, status, flag_count, created_at, moderation_decision, moderation_reason
     from moments
     where flag_count > 0 or status in ('hidden', 'removed')
     order by
       case when status = 'hidden' then 0 when status = 'live' then 1 else 2 end,
       created_at desc
     limit $1`,
    [limit]
  );
}

export async function getRecentLiveMoments(limit = 50) {
  return query<any>(
    `select id, short_id, text, status, flag_count, created_at, moderation_decision
     from moments where status = 'live'
     order by created_at desc limit $1`,
    [limit]
  );
}

export async function getRecentRejectedMoments(limit = 30) {
  return query<any>(
    `select id, short_id, text, status, flag_count, created_at, moderation_decision, moderation_reason
     from moments where status = 'rejected'
     order by created_at desc limit $1`,
    [limit]
  );
}

export async function getMomentCounts(): Promise<Record<string, number>> {
  const rows = await query<{ status: string; n: number }>(
    `select status, count(*)::int as n from moments group by status`
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export async function insertAdminMoment(text: string) {
  const short_id = genShortId();
  const rows = await query<any>(
    `insert into moments (short_id, text, status, moderation_decision, moderation_reason, ip_hash)
     values ($1, $2, 'live', 'admin', 'added by admin', 'admin')
     returning id, short_id, text, status`,
    [short_id, text]
  );
  return rows[0];
}

export async function setMomentStatus(
  shortId: string,
  status: 'live' | 'hidden' | 'removed'
) {
  await query(`update moments set status = $1 where short_id = $2`, [status, shortId]);
}

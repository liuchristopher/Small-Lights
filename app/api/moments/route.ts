import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getRandomLiveMoment,
  insertMoment,
  countLiveMoments,
} from '@/lib/db';
import { moderate } from '@/lib/moderation';
import { hashIp, getClientIp } from '@/lib/hash';
import { checkRateLimit } from '@/lib/rate-limit';

const SEEN_COOKIE = 'sl_seen';
const MAX_SEEN = 20;

export async function GET() {
  const cookieStore = cookies();
  const seen = (cookieStore.get(SEEN_COOKIE)?.value ?? '')
    .split(',')
    .filter(Boolean);

  let m = await getRandomLiveMoment(seen);
  // If we've seen everything, reset
  if (!m && seen.length > 0) {
    m = await getRandomLiveMoment([]);
  }
  if (!m) {
    return NextResponse.json({ error: 'no_moments' }, { status: 404 });
  }

  const updated = [m.short_id, ...seen.filter((s) => s !== m!.short_id)].slice(
    0,
    MAX_SEEN
  );

  const res = NextResponse.json({ shortId: m.short_id, text: m.text });
  res.cookies.set(SEEN_COOKIE, updated.join(','), {
    maxAge: 60 * 60 * 24,
    sameSite: 'lax',
    httpOnly: false,
    path: '/',
  });
  return res;
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_body' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length < 4 || text.length > 600) {
    return NextResponse.json({ error: 'invalid_text' }, { status: 400 });
  }

  const ip = getClientIp(req.headers);
  const ipHash = hashIp(ip);

  const rl = await checkRateLimit(ipHash);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', reason: rl.reason },
      { status: 429 }
    );
  }

  let decision;
  try {
    decision = await moderate(text);
  } catch (e) {
    console.error('moderation failed:', e);
    return NextResponse.json({ error: 'moderation_failed' }, { status: 500 });
  }

  if (decision.decision === 'crisis') {
    // Do NOT insert. Return crisis status so client shows the resource page.
    return NextResponse.json({ status: 'crisis' });
  }

  if (decision.decision === 'reject') {
    // Silent drop: store as rejected so the rate limit still counts,
    // but return "approved" to the client so spammers can't probe the filter.
    await insertMoment({
      text,
      status: 'rejected',
      moderationDecision: 'reject',
      moderationReason: decision.reason,
      ipHash,
    });
    return NextResponse.json({ status: 'approved' });
  }

  const m = await insertMoment({
    text,
    status: 'live',
    moderationDecision: 'approve',
    moderationReason: decision.reason,
    ipHash,
  });

  const count = await countLiveMoments();
  return NextResponse.json({
    status: 'approved',
    shortId: m.short_id,
    text: m.text,
    count,
  });
}

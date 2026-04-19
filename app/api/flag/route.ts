import { NextRequest, NextResponse } from 'next/server';
import { getMomentByShortId, insertFlag } from '@/lib/db';
import { hashIp, getClientIp } from '@/lib/hash';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_body' }, { status: 400 });
  }

  const shortId =
    typeof body.shortId === 'string' && body.shortId.length > 0
      ? body.shortId
      : null;
  if (!shortId) {
    return NextResponse.json({ error: 'missing_shortId' }, { status: 400 });
  }

  const m = await getMomentByShortId(shortId);
  if (!m) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const ip = getClientIp(req.headers);
  const ipHash = hashIp(ip);

  const ok = await insertFlag(m.id, ipHash);
  return NextResponse.json({ ok });
}

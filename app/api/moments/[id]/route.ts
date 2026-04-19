import { NextResponse } from 'next/server';
import { getMomentByShortId } from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const m = await getMomentByShortId(params.id);
  if (!m || m.status !== 'live') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ shortId: m.short_id, text: m.text });
}

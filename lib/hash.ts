import crypto from 'crypto';

export function hashIp(ip: string | null | undefined): string {
  const secret = process.env.HASH_SECRET;
  if (!secret) throw new Error('HASH_SECRET not set');
  const input = (ip ?? 'unknown').trim();
  return crypto.createHash('sha256').update(input + secret).digest('hex').slice(0, 32);
}

export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return headers.get('x-real-ip') || 'unknown';
}

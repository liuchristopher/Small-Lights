import { ImageResponse } from 'next/og';
import { getMomentByShortId } from '@/lib/db';

export const runtime = 'nodejs';
export const alt = 'small lights';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: { id: string } }) {
  const m = await getMomentByShortId(params.id);
  const text = m?.text ?? 'a small light';
  const textSize = text.length > 400 ? 28 : text.length > 220 ? 34 : 42;

  return new ImageResponse(
    (
      <div
        style={{
          background: '#f2e8d5',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 120px',
          color: '#2a1f15',
          fontFamily: 'serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            fontSize: 26,
            color: '#c4a87a',
            letterSpacing: '0.4em',
            marginBottom: 40,
          }}
        >
          ·  ·  ·
        </div>
        <div
          style={{
            fontSize: textSize,
            lineHeight: 1.45,
            textAlign: 'center',
            maxWidth: 960,
            fontStyle: 'italic',
            fontWeight: 300,
            color: '#2a1f15',
          }}
        >
          {text}
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 22,
            color: '#8a7560',
            fontStyle: 'italic',
          }}
        >
          — anonymous
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            fontSize: 18,
            color: '#8a7560',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
          }}
        >
          small lights
        </div>
      </div>
    ),
    { ...size }
  );
}

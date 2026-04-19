import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'small lights';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
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
          padding: 80,
          color: '#2a1f15',
          fontFamily: 'serif',
        }}
      >
        <div
          style={{
            fontSize: 54,
            fontStyle: 'italic',
            color: '#6b5845',
            letterSpacing: '0.02em',
          }}
        >
          small
        </div>
        <div
          style={{
            fontSize: 170,
            marginTop: -30,
            letterSpacing: '-0.02em',
            fontWeight: 400,
          }}
        >
          lights
        </div>
        <div
          style={{
            marginTop: 50,
            fontSize: 30,
            color: '#c4a87a',
            letterSpacing: '0.4em',
          }}
        >
          ·  ·  ·
        </div>
        <div
          style={{
            marginTop: 50,
            fontSize: 28,
            color: '#6b5845',
            textAlign: 'center',
            maxWidth: 800,
            fontStyle: 'italic',
            fontWeight: 300,
          }}
        >
          A quiet place. Anonymous moments of peace, beauty, and small joy — to read on a hard day.
        </div>
      </div>
    ),
    { ...size }
  );
}

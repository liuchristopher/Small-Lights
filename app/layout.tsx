import type { Metadata } from 'next';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://smalllights.co';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'small lights',
    template: '%s · small lights',
  },
  description:
    'A quiet place. Anonymous moments of peace, beauty, and small joy — to read on a hard day.',
  openGraph: {
    title: 'small lights',
    description:
      'A quiet place. Anonymous moments of peace, beauty, and small joy — to read on a hard day.',
    url: SITE_URL,
    siteName: 'small lights',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'small lights',
    description:
      'A quiet place. Anonymous moments of peace, beauty, and small joy — to read on a hard day.',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&family=Karla:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {plausibleDomain && (
          <script
            defer
            data-domain={plausibleDomain}
            src="https://plausible.io/js/script.js"
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import SmallLights from '@/components/SmallLights';
import { getMomentByShortId } from '@/lib/db';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://smalllights.co';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const m = await getMomentByShortId(params.id);
  if (!m || m.status !== 'live') {
    return { title: 'small lights' };
  }
  const excerpt = m.text.length > 160 ? m.text.slice(0, 157) + '…' : m.text;
  const url = `${SITE_URL}/m/${params.id}`;
  return {
    title: 'small lights',
    description: excerpt,
    openGraph: {
      title: 'small lights',
      description: excerpt,
      url,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'small lights',
      description: excerpt,
    },
    alternates: { canonical: url },
  };
}

export default async function MomentPage({
  params,
}: {
  params: { id: string };
}) {
  const m = await getMomentByShortId(params.id);
  if (!m || m.status !== 'live') notFound();
  return (
    <SmallLights
      initialMoment={{ shortId: m.short_id, text: m.text }}
      initialCount={0}
    />
  );
}

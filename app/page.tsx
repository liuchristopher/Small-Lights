import SmallLights from '@/components/SmallLights';
import { getRandomLiveMoment, countLiveMoments } from '@/lib/db';

// Always pick a fresh random moment on server render
export const dynamic = 'force-dynamic';

export default async function Home() {
  const [initial, count] = await Promise.all([
    getRandomLiveMoment([]),
    countLiveMoments(),
  ]);

  const initialMoment = initial
    ? { shortId: initial.short_id, text: initial.text }
    : null;

  return <SmallLights initialMoment={initialMoment} initialCount={count} />;
}

import {
  getFlaggedOrHiddenMoments,
  getRecentLiveMoments,
  getRecentRejectedMoments,
  getMomentCounts,
  getMomentByShortId,
} from '@/lib/db';
import { reviewAction, createMomentAction } from './actions';

export const dynamic = 'force-dynamic';

const wrap: React.CSSProperties = {
  maxWidth: 960,
  margin: '0 auto',
  padding: '40px 28px',
  fontFamily: 'Fraunces, Georgia, serif',
  background: '#f2e8d5',
  minHeight: '100vh',
  color: '#2a1f15',
};

const sectionHeading: React.CSSProperties = {
  fontSize: '1.35rem',
  fontWeight: 400,
  letterSpacing: '-0.01em',
  marginTop: 48,
  marginBottom: 16,
  borderBottom: '1px solid #d4c5a8',
  paddingBottom: 8,
};

const metaRow: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  fontSize: '0.68rem',
  textTransform: 'uppercase',
  letterSpacing: '0.2em',
  color: '#6b5845',
  fontFamily: 'Karla, sans-serif',
  flexWrap: 'wrap',
};

const btn: React.CSSProperties = {
  padding: '6px 14px',
  fontFamily: 'Karla, sans-serif',
  fontSize: '0.7rem',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  borderRadius: 0,
};
const btnOutline: React.CSSProperties = { ...btn, border: '1px solid #2a1f15', background: 'transparent', color: '#2a1f15' };
const btnMuted: React.CSSProperties = { ...btn, border: '1px solid #8a7560', background: 'transparent', color: '#6b5845' };
const btnDanger: React.CSSProperties = { ...btn, background: '#2a1f15', color: '#f2e8d5', border: '1px solid #2a1f15' };

function MomentCard({ m, showRestore = false }: { m: any; showRestore?: boolean }) {
  const bg =
    m.status === 'live' ? '#fffbf0' :
    m.status === 'hidden' ? '#f9efd9' :
    m.status === 'removed' ? '#eadcc0' :
    m.status === 'rejected' ? '#f4e4e0' :
    '#fffbf0';
  return (
    <div style={{ padding: 18, marginBottom: 14, border: '1px solid #d4c5a8', background: bg }}>
      <div style={metaRow}>
        <span>status: {m.status}</span>
        <span>flags: {m.flag_count}</span>
        <span>id: {m.short_id}</span>
        <span>{new Date(m.created_at).toISOString().slice(0, 10)}</span>
        {m.moderation_decision && <span>mod: {m.moderation_decision}</span>}
      </div>
      <p style={{ marginTop: 10, fontSize: '1.05rem', fontStyle: 'italic', fontWeight: 300, lineHeight: 1.5 }}>
        {m.text}
      </p>
      {m.moderation_reason && (
        <p style={{ marginTop: 6, fontSize: '0.78rem', color: '#8a7560', fontFamily: 'Karla, sans-serif' }}>
          mod note: {m.moderation_reason}
        </p>
      )}
      <form action={reviewAction} style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input type="hidden" name="shortId" value={m.short_id} />
        {(m.status !== 'live' || showRestore) && (
          <button type="submit" name="action" value="restore" style={btnOutline}>restore to live</button>
        )}
        {m.status === 'live' && (
          <button type="submit" name="action" value="hide" style={btnMuted}>hide</button>
        )}
        <button type="submit" name="action" value="remove" style={btnDanger}>remove</button>
      </form>
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const lookupId = typeof searchParams.id === 'string' ? searchParams.id.trim() : '';
  const [lookupMoment, reviewQueue, recentLive, recentRejected, counts] = await Promise.all([
    lookupId ? getMomentByShortId(lookupId) : Promise.resolve(null),
    getFlaggedOrHiddenMoments(100),
    getRecentLiveMoments(50),
    getRecentRejectedMoments(30),
    getMomentCounts(),
  ]);

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: '2rem', fontWeight: 400, letterSpacing: '-0.01em', margin: 0 }}>
        small lights — admin
      </h1>
      <p style={{ color: '#6b5845', marginTop: 6, fontSize: '0.9rem', fontFamily: 'Karla, sans-serif', letterSpacing: '0.05em' }}>
        {(counts.live ?? 0)} live · {(counts.hidden ?? 0)} hidden · {(counts.removed ?? 0)} removed · {(counts.rejected ?? 0)} rejected
      </p>

      {/* Lookup */}
      <h2 style={sectionHeading}>Look up a moment</h2>
      <form method="GET" style={{ display: 'flex', gap: 10 }}>
        <input
          type="text"
          name="id"
          defaultValue={lookupId}
          placeholder="short_id from a /m/… URL"
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #d4c5a8',
            background: '#fffbf0',
            fontFamily: 'Karla, sans-serif',
            fontSize: '0.9rem',
            borderRadius: 0,
          }}
        />
        <button type="submit" style={btnOutline}>find</button>
        {lookupId && (
          <a href="/admin" style={{ ...btnMuted, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            clear
          </a>
        )}
      </form>
      {lookupId && !lookupMoment && (
        <p style={{ marginTop: 14, fontStyle: 'italic', color: '#8a7560' }}>
          No moment with id <code>{lookupId}</code>.
        </p>
      )}
      {lookupMoment && (
        <div style={{ marginTop: 14 }}>
          <MomentCard m={lookupMoment} showRestore />
        </div>
      )}

      {/* Compose */}
      <h2 style={sectionHeading}>Add a moment</h2>
      <p style={{ fontSize: '0.9rem', color: '#6b5845', marginBottom: 12, fontFamily: 'Karla, sans-serif' }}>
        Bypasses moderation. Goes directly to <code>live</code>. Use for curation, friends-submitted moments with permission, or seeding tone.
      </p>
      <form action={createMomentAction}>
        <textarea
          name="text"
          rows={5}
          maxLength={600}
          placeholder="A moment…"
          required
          style={{
            width: '100%',
            padding: 12,
            border: '1px solid #d4c5a8',
            background: '#fffbf0',
            fontFamily: 'Fraunces, Georgia, serif',
            fontWeight: 300,
            fontSize: '1.05rem',
            lineHeight: 1.55,
            color: '#2a1f15',
            borderRadius: 0,
            resize: 'vertical',
          }}
        />
        <div style={{ marginTop: 10 }}>
          <button type="submit" style={btnDanger}>add as live</button>
        </div>
      </form>

      {/* Review queue */}
      <h2 style={sectionHeading}>Review queue ({reviewQueue.length})</h2>
      {reviewQueue.length === 0 ? (
        <p style={{ fontStyle: 'italic', color: '#8a7560' }}>Nothing flagged. Quiet day.</p>
      ) : (
        <div>{reviewQueue.map((m: any) => <MomentCard key={m.id} m={m} />)}</div>
      )}

      {/* Recent live */}
      <h2 style={sectionHeading}>Recent live ({recentLive.length})</h2>
      <p style={{ fontSize: '0.88rem', color: '#6b5845', marginTop: -8, marginBottom: 14, fontFamily: 'Karla, sans-serif' }}>
        The last 50 approved moments. Remove any at your discretion — you don't need to wait for flags.
      </p>
      {recentLive.length === 0 ? (
        <p style={{ fontStyle: 'italic', color: '#8a7560' }}>No live moments.</p>
      ) : (
        <div>{recentLive.map((m: any) => <MomentCard key={m.id} m={m} />)}</div>
      )}

      {/* Recent rejected — for spot-checking false positives */}
      <h2 style={sectionHeading}>Recent rejected by moderator ({recentRejected.length})</h2>
      <p style={{ fontSize: '0.88rem', color: '#6b5845', marginTop: -8, marginBottom: 14, fontFamily: 'Karla, sans-serif' }}>
        Submissions Claude marked as <code>reject</code>. Spot-check for false positives — if sincere moments are here, loosen the moderation prompt in <code>lib/moderation.ts</code>. You can restore any of these to live if they were wrongly rejected.
      </p>
      {recentRejected.length === 0 ? (
        <p style={{ fontStyle: 'italic', color: '#8a7560' }}>None.</p>
      ) : (
        <div>{recentRejected.map((m: any) => <MomentCard key={m.id} m={m} showRestore />)}</div>
      )}
    </div>
  );
}

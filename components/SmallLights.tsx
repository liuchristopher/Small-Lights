'use client';

import { useState, useEffect, useRef } from 'react';

interface Moment {
  shortId: string;
  text: string;
}

interface Props {
  initialMoment: Moment | null;
  initialCount: number;
}

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://smalllights.co';

// localStorage keys
const LS_SAVED = 'sl_saved_v1'; // array of {shortId, text}
const LS_FLAGGED = 'sl_flagged_v1'; // array of shortIds

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function writeLS(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export default function SmallLights({ initialMoment, initialCount }: Props) {
  const [view, setView] = useState<'read' | 'write' | 'about' | 'saved'>('read');
  const [current, setCurrent] = useState<Moment | null>(initialMoment);
  const [fading, setFading] = useState(false);
  const [count, setCount] = useState(initialCount);

  const [savedMoments, setSavedMoments] = useState<Moment[]>([]);
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());

  const [draft, setDraft] = useState('');
  const [submitState, setSubmitState] = useState<
    | 'idle'
    | 'reading'
    | 'approved'
    | 'quiet_dropped'
    | 'crisis'
    | 'rate_limited'
    | 'error'
  >('idle');
  const [rateReason, setRateReason] = useState<'cooldown' | 'daily' | null>(null);

  const [flagConfirm, setFlagConfirm] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copyConfirm, setCopyConfirm] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canNativeShare =
    typeof navigator !== 'undefined' &&
    typeof (navigator as any).share === 'function';

  // Load saved + flagged from localStorage on mount
  useEffect(() => {
    setSavedMoments(readLS<Moment[]>(LS_SAVED, []));
    setFlaggedIds(new Set(readLS<string[]>(LS_FLAGGED, [])));
  }, []);

  const savedKeys = new Set(savedMoments.map((m) => m.shortId));

  async function fetchNext() {
    try {
      const res = await fetch('/api/moments', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setCurrent({ shortId: data.shortId, text: data.text });
    } catch {}
  }

  function nextMoment() {
    if (!current) return;
    setFading(true);
    fetchNext().finally(() => {
      setTimeout(() => setFading(false), 50);
    });
    setTimeout(() => setFading(false), 600);
  }

  function toggleSave(m: Moment) {
    let next: Moment[];
    if (savedKeys.has(m.shortId)) {
      next = savedMoments.filter((s) => s.shortId !== m.shortId);
    } else {
      next = [...savedMoments, m];
    }
    setSavedMoments(next);
    writeLS(LS_SAVED, next);
  }

  function buildShareUrl(shortId: string) {
    return `${SITE_URL}/m/${shortId}`;
  }
  function buildShareText(m: Moment) {
    const trimmed =
      m.text.length > 180 ? m.text.slice(0, 177) + '…' : m.text;
    return `"${trimmed}"\n\nfrom small lights`;
  }

  async function shareVia(type: 'native' | 'copy' | 'email' | 'x') {
    if (!current) return;
    const url = buildShareUrl(current.shortId);
    const text = buildShareText(current);
    try {
      if (type === 'native' && canNativeShare) {
        await (navigator as any).share({ title: 'small lights', text, url });
      } else if (type === 'copy') {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setCopyConfirm(true);
        setTimeout(() => setCopyConfirm(false), 1600);
      } else if (type === 'email') {
        window.open(
          `mailto:?subject=${encodeURIComponent(
            'a small light'
          )}&body=${encodeURIComponent(text + '\n\n' + url)}`
        );
      } else if (type === 'x') {
        const tweet = `${text} ${url}`;
        window.open(
          `https://x.com/intent/tweet?text=${encodeURIComponent(tweet)}`,
          '_blank',
          'noopener,noreferrer'
        );
      }
    } catch {}
    if (type !== 'copy') setShareMenuOpen(false);
  }

  async function handleFlag() {
    if (!current || flagConfirm) return;
    if (flaggedIds.has(current.shortId)) return;

    const shortId = current.shortId;
    setFlagConfirm(true);

    // Optimistic: remember locally so we don't re-show
    const nextFlagged = new Set(flaggedIds);
    nextFlagged.add(shortId);
    setFlaggedIds(nextFlagged);
    writeLS(LS_FLAGGED, [...nextFlagged]);

    // Fire-and-forget server flag
    fetch('/api/flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortId }),
    }).catch(() => {});

    setTimeout(() => {
      setFlagConfirm(false);
      setFading(true);
      fetchNext().finally(() => {
        setTimeout(() => setFading(false), 50);
      });
    }, 1400);
  }

  async function handleSubmit() {
    const text = draft.trim();
    if (!text || submitState !== 'idle') return;

    setSubmitState('reading');
    let res;
    try {
      res = await fetch('/api/moments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    } catch {
      setSubmitState('error');
      return;
    }

    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      setRateReason(data.reason ?? null);
      setSubmitState('rate_limited');
      return;
    }

    if (!res.ok) {
      setSubmitState('error');
      return;
    }

    const data = await res.json();

    if (data.status === 'crisis') {
      setSubmitState('crisis');
      return;
    }

    // 'approved' covers both true-approve and silent-drop
    if (data.shortId && data.text) {
      // Real approval — set as current
      setCurrent({ shortId: data.shortId, text: data.text });
      if (typeof data.count === 'number') setCount(data.count);
      setSubmitState('approved');
      setTimeout(() => {
        setDraft('');
        setView('read');
        setSubmitState('idle');
      }, 2200);
    } else {
      // Silent drop — show thank-you identically
      setSubmitState('quiet_dropped');
      setTimeout(() => {
        setDraft('');
        setView('read');
        setSubmitState('idle');
      }, 2400);
    }
  }

  useEffect(() => {
    if (view === 'write' && textareaRef.current && submitState === 'idle') {
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [view, submitState]);

  function resetWrite() {
    setDraft('');
    setSubmitState('idle');
    setRateReason(null);
    setView('read');
  }

  const charLimit = 600;
  const charsLeft = charLimit - draft.length;

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{
        background: '#f2e8d5',
        color: '#2a1f15',
        fontFamily: "'Fraunces', Georgia, serif",
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='2' seed='3'/%3E%3CfeColorMatrix values='0 0 0 0 0.16 0 0 0 0 0.12 0 0 0 0 0.08 0 0 0 0.05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    >
      <header className="w-full px-6 pt-6 pb-2 flex items-center justify-between">
        <button
          onClick={() => { if (submitState === 'idle') setView('read'); }}
          className="text-left transition-opacity hover:opacity-60"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          <div className="text-sm italic" style={{ color: '#6b5845', letterSpacing: '0.02em' }}>small</div>
          <div className="text-xl -mt-1" style={{ fontWeight: 400, letterSpacing: '-0.01em' }}>lights</div>
        </button>
        <div className="flex items-center gap-5">
          {savedMoments.length > 0 && (
            <button
              onClick={() => setView(view === 'saved' ? 'read' : 'saved')}
              className="text-xs uppercase tracking-widest transition-opacity hover:opacity-60"
              style={{ fontFamily: "'Karla', sans-serif", color: '#6b5845', letterSpacing: '0.18em' }}
            >
              saved ({savedMoments.length})
            </button>
          )}
          <button
            onClick={() => setView(view === 'about' ? 'read' : 'about')}
            className="text-xs uppercase tracking-widest transition-opacity hover:opacity-60"
            style={{ fontFamily: "'Karla', sans-serif", color: '#6b5845', letterSpacing: '0.18em' }}
          >
            {view === 'about' ? 'close' : 'about'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-8 w-full">

        {view === 'read' && current && (
          <div
            className="w-full max-w-xl flex flex-col items-center"
            style={{
              opacity: fading ? 0 : 1,
              transition: 'opacity 450ms ease-in-out',
            }}
          >
            <div className="mb-10" style={{ fontFamily: "'Fraunces', serif", color: '#c4a87a', fontSize: '1.2rem', letterSpacing: '0.4em' }}>·  ·  ·</div>

            <p
              className="text-center"
              style={{
                fontFamily: "'Fraunces', Georgia, serif",
                fontWeight: 300,
                fontSize: 'clamp(1.35rem, 4.5vw, 1.7rem)',
                lineHeight: 1.55,
                letterSpacing: '-0.005em',
                color: '#2a1f15',
                fontVariationSettings: "'opsz' 72",
              }}
            >
              {current.text}
            </p>

            <div className="mt-10 text-center italic" style={{ fontFamily: "'Fraunces', serif", color: '#8a7560', fontSize: '0.95rem', fontWeight: 300 }}>
              — anonymous
            </div>

            <div
              className="mt-5 flex items-center justify-center gap-4"
              style={{
                fontFamily: "'Karla', sans-serif",
                fontSize: '0.62rem',
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
              }}
            >
              <button
                onClick={() => toggleSave(current)}
                style={{
                  color: savedKeys.has(current.shortId) ? '#6b5845' : '#b5a58a',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  opacity: savedKeys.has(current.shortId) ? 1 : 0.6,
                  transition: 'opacity 200ms',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = savedKeys.has(current.shortId) ? '1' : '0.6')}
              >
                {savedKeys.has(current.shortId) ? 'saved' : 'save'}
              </button>
              <span style={{ color: '#d4c5a8', opacity: 0.6 }}>·</span>
              <button
                onClick={() => { setShareMenuOpen((v) => !v); setCopyConfirm(false); }}
                style={{
                  color: shareMenuOpen ? '#6b5845' : '#b5a58a',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  opacity: shareMenuOpen ? 1 : 0.6,
                  transition: 'opacity 200ms',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = shareMenuOpen ? '1' : '0.6')}
              >
                share
              </button>
              <span style={{ color: '#d4c5a8', opacity: 0.6 }}>·</span>
              <button
                onClick={handleFlag}
                disabled={flagConfirm}
                aria-label="Report this moment"
                style={{
                  color: flagConfirm ? '#6b5845' : '#b5a58a',
                  background: 'transparent', border: 'none',
                  cursor: flagConfirm ? 'default' : 'pointer',
                  opacity: flagConfirm ? 1 : 0.6,
                  transition: 'opacity 200ms',
                }}
                onMouseEnter={(e) => { if (!flagConfirm) e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={(e) => { if (!flagConfirm) e.currentTarget.style.opacity = '0.6'; }}
              >
                {flagConfirm ? 'thank you' : 'report'}
              </button>
            </div>

            {shareMenuOpen && (
              <div
                className="mt-4 flex items-center gap-3 flex-wrap justify-center"
                style={{
                  fontFamily: "'Karla', sans-serif",
                  fontSize: '0.62rem',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  animation: 'fadeIn 400ms ease',
                }}
              >
                {canNativeShare && (
                  <>
                    <button onClick={() => shareVia('native')}
                      style={{ color: '#6b5845', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                      share…
                    </button>
                    <span style={{ color: '#d4c5a8' }}>·</span>
                  </>
                )}
                <button onClick={() => shareVia('copy')}
                  style={{ color: '#6b5845', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  {copyConfirm ? 'copied ✓' : 'copy'}
                </button>
                <span style={{ color: '#d4c5a8' }}>·</span>
                <button onClick={() => shareVia('email')}
                  style={{ color: '#6b5845', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  email
                </button>
                <span style={{ color: '#d4c5a8' }}>·</span>
                <button onClick={() => shareVia('x')}
                  style={{ color: '#6b5845', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  x
                </button>
                <span style={{ color: '#d4c5a8' }}>·</span>
                <button onClick={() => setShareMenuOpen(false)}
                  style={{ color: '#b5a58a', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  close
                </button>
              </div>
            )}

            <div className="mt-12 flex flex-col sm:flex-row gap-3 sm:gap-6 items-center">
              <button
                onClick={nextMoment}
                className="px-6 py-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  fontFamily: "'Karla', sans-serif", fontSize: '0.72rem', letterSpacing: '0.22em', textTransform: 'uppercase',
                  border: '1px solid #2a1f15', color: '#2a1f15', background: 'transparent', borderRadius: 0,
                }}
              >
                another moment
              </button>
              <button
                onClick={() => setView('write')}
                className="px-6 py-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  fontFamily: "'Karla', sans-serif", fontSize: '0.72rem', letterSpacing: '0.22em', textTransform: 'uppercase',
                  background: '#2a1f15', color: '#f2e8d5', border: '1px solid #2a1f15', borderRadius: 0,
                }}
              >
                share one of yours
              </button>
            </div>
          </div>
        )}

        {view === 'write' && (
          <div className="w-full max-w-xl" style={{ animation: 'fadeIn 600ms ease' }}>

            {submitState === 'idle' && (
              <>
                <button
                  onClick={resetWrite}
                  className="mb-8 transition-opacity hover:opacity-60"
                  style={{ fontFamily: "'Karla', sans-serif", fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#6b5845' }}
                >
                  ← back
                </button>

                <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(1.6rem, 5vw, 2.1rem)', fontWeight: 400, letterSpacing: '-0.015em', lineHeight: 1.15, color: '#2a1f15' }}>
                  Share a moment.
                </h2>

                <p className="mt-4 italic" style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: '1.05rem', lineHeight: 1.55, color: '#6b5845', maxWidth: '32rem' }}>
                  Anything that was beautiful, or quiet, or peaceful. A moment that still gives you something when you remember it. Say it simply. Say what happened.
                </p>

                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, charLimit))}
                  placeholder="The light was almost gone, and…"
                  rows={7}
                  className="w-full mt-8 p-4 resize-none focus:outline-none"
                  style={{
                    fontFamily: "'Fraunces', Georgia, serif", fontWeight: 300, fontSize: '1.15rem', lineHeight: 1.6, color: '#2a1f15',
                    background: 'rgba(255, 251, 240, 0.5)', border: '1px solid #d4c5a8', borderRadius: 0,
                  }}
                />

                <div className="mt-2 flex items-center justify-between">
                  <span style={{ fontFamily: "'Karla', sans-serif", fontSize: '0.7rem', color: charsLeft < 60 ? '#a8603d' : '#a89680', letterSpacing: '0.05em' }}>
                    {charsLeft} characters left
                  </span>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <button
                    onClick={handleSubmit}
                    disabled={!draft.trim()}
                    className="px-7 py-3 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{
                      fontFamily: "'Karla', sans-serif", fontSize: '0.72rem', letterSpacing: '0.22em', textTransform: 'uppercase',
                      background: '#2a1f15', color: '#f2e8d5', border: '1px solid #2a1f15', borderRadius: 0,
                    }}
                  >
                    offer it
                  </button>
                  <span className="italic" style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: '0.85rem', color: '#8a7560' }}>
                    your name is never attached.
                  </span>
                </div>
              </>
            )}

            {submitState === 'reading' && (
              <div className="text-center py-24">
                <div style={{ fontFamily: "'Fraunces', serif", color: '#c4a87a', fontSize: '1.2rem', letterSpacing: '0.4em' }}>·  ·  ·</div>
                <p className="mt-8 italic" style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: '1.1rem', color: '#6b5845' }}>
                  reading your words…
                </p>
              </div>
            )}

            {(submitState === 'approved' || submitState === 'quiet_dropped') && (
              <div className="text-center py-20">
                <div style={{ fontFamily: "'Fraunces', serif", color: '#c4a87a', fontSize: '1.2rem', letterSpacing: '0.4em' }}>·  ·  ·</div>
                <p className="mt-8 italic" style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: '1.3rem', color: '#2a1f15' }}>
                  Thank you.
                </p>
                <p className="mt-4" style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: '1rem', color: '#8a7560' }}>
                  Someone, somewhere, will read this on a hard day.
                </p>
              </div>
            )}

            {submitState === 'crisis' && (
              <div className="py-8" style={{ animation: 'fadeIn 500ms ease' }}>
                <div style={{ fontFamily: "'Fraunces', serif", color: '#c4a87a', fontSize: '1rem', letterSpacing: '0.4em', textAlign: 'center' }}>·  ·  ·</div>
                <p className="mt-8 italic" style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: '1.25rem', lineHeight: 1.55, color: '#2a1f15' }}>
                  Reading what you wrote, it sounds like right now is very hard.
                </p>
                <p className="mt-5" style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: '1.05rem', lineHeight: 1.65, color: '#2a1f15' }}>
                  Please talk to someone tonight. Not tomorrow — tonight. In the US you can call or text <strong style={{ fontWeight: 500 }}>988</strong> and someone will pick up. In the UK, <strong style={{ fontWeight: 500 }}>Samaritans 116 123</strong>. In most countries there is a line — <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer" style={{ color: '#2a1f15', textDecoration: 'underline' }}>findahelpline.com</a> will help you find yours.
                </p>
                <p className="mt-5" style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: '1.05rem', lineHeight: 1.65, color: '#2a1f15' }}>
                  You are not alone, even when it feels exactly that way. Come back another day and leave a moment here when you're ready. There is space for you here.
                </p>
                <div className="mt-10">
                  <button
                    onClick={resetWrite}
                    className="px-6 py-3"
                    style={{
                      fontFamily: "'Karla', sans-serif", fontSize: '0.72rem', letterSpacing: '0.22em', textTransform: 'uppercase',
                      background: '#2a1f15', color: '#f2e8d5', border: '1px solid #2a1f15', borderRadius: 0, cursor: 'pointer',
                    }}
                  >
                    okay
                  </button>
                </div>
              </div>
            )}

            {submitState === 'rate_limited' && (
              <div className="py-16 text-center" style={{ animation: 'fadeIn 500ms ease' }}>
                <p className="italic" style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: '1.2rem', lineHeight: 1.55, color: '#2a1f15' }}>
                  {rateReason === 'daily'
                    ? "You've shared several moments today. Come back tomorrow — we'll be here."
                    : "Just a little while between offerings. Try again in a few minutes."}
                </p>
                <button
                  onClick={resetWrite}
                  className="mt-8 px-6 py-3"
                  style={{
                    fontFamily: "'Karla', sans-serif", fontSize: '0.72rem', letterSpacing: '0.22em', textTransform: 'uppercase',
                    border: '1px solid #2a1f15', color: '#2a1f15', background: 'transparent', borderRadius: 0, cursor: 'pointer',
                  }}
                >
                  back
                </button>
              </div>
            )}

            {submitState === 'error' && (
              <div className="py-16 text-center" style={{ animation: 'fadeIn 500ms ease' }}>
                <p className="italic" style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: '1.15rem', color: '#2a1f15' }}>
                  Something went wrong. Your words are safe — try once more in a moment.
                </p>
                <div className="mt-8 flex justify-center gap-4">
                  <button
                    onClick={() => setSubmitState('idle')}
                    className="px-6 py-3"
                    style={{
                      fontFamily: "'Karla', sans-serif", fontSize: '0.72rem', letterSpacing: '0.22em', textTransform: 'uppercase',
                      background: '#2a1f15', color: '#f2e8d5', border: '1px solid #2a1f15', borderRadius: 0, cursor: 'pointer',
                    }}
                  >
                    try again
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'saved' && (
          <div className="w-full max-w-2xl" style={{ animation: 'fadeIn 600ms ease' }}>
            <button
              onClick={() => setView('read')}
              className="mb-8 transition-opacity hover:opacity-60"
              style={{ fontFamily: "'Karla', sans-serif", fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#6b5845' }}
            >
              ← back
            </button>

            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(1.6rem, 5vw, 2.1rem)', fontWeight: 400, letterSpacing: '-0.015em', lineHeight: 1.15, color: '#2a1f15' }}>
              Your saved moments.
            </h2>
            <p className="mt-3 italic" style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: '1rem', color: '#6b5845' }}>
              A small collection you can return to on a hard day.
            </p>

            <div className="mt-10 space-y-10">
              {savedMoments.length === 0 ? (
                <p className="italic" style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: '1rem', color: '#8a7560' }}>
                  Nothing saved yet.
                </p>
              ) : (
                savedMoments.map((m) => (
                  <div key={m.shortId} style={{ borderBottom: '1px solid #e4d7b8', paddingBottom: '2rem' }}>
                    <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 300, fontSize: '1.15rem', lineHeight: 1.6, color: '#2a1f15' }}>
                      {m.text}
                    </p>
                    <div className="mt-4 flex items-center gap-4">
                      <span className="italic" style={{ fontFamily: "'Fraunces', serif", fontSize: '0.85rem', fontWeight: 300, color: '#8a7560' }}>
                        — anonymous
                      </span>
                      <span style={{ color: '#d4c5a8' }}>·</span>
                      <a
                        href={buildShareUrl(m.shortId)}
                        style={{
                          fontFamily: "'Karla', sans-serif", fontSize: '0.62rem',
                          letterSpacing: '0.28em', textTransform: 'uppercase',
                          color: '#b5a58a', textDecoration: 'none',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#6b5845')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#b5a58a')}
                      >
                        open
                      </a>
                      <span style={{ color: '#d4c5a8' }}>·</span>
                      <button
                        onClick={() => toggleSave(m)}
                        style={{
                          fontFamily: "'Karla', sans-serif", fontSize: '0.62rem',
                          letterSpacing: '0.28em', textTransform: 'uppercase',
                          color: '#b5a58a', background: 'transparent', border: 'none', cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#6b5845')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#b5a58a')}
                      >
                        unsave
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {savedMoments.length > 0 && (
              <div className="mt-12 flex items-center gap-4 flex-wrap">
                <button
                  onClick={async () => {
                    const text = savedMoments
                      .map((m) => `"${m.text}"\n\n— anonymous`)
                      .join('\n\n·  ·  ·\n\n');
                    try { await navigator.clipboard.writeText(text); } catch {}
                  }}
                  className="px-5 py-2.5 transition-all hover:scale-[1.02]"
                  style={{
                    fontFamily: "'Karla', sans-serif", fontSize: '0.68rem',
                    letterSpacing: '0.22em', textTransform: 'uppercase',
                    border: '1px solid #2a1f15', color: '#2a1f15',
                    background: 'transparent', borderRadius: 0, cursor: 'pointer',
                  }}
                >
                  copy all
                </button>
                <span className="italic" style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: '0.85rem', color: '#8a7560' }}>
                  tip: paste them somewhere you can find them later.
                </span>
              </div>
            )}
          </div>
        )}

        {view === 'about' && (
          <div className="w-full max-w-lg" style={{ animation: 'fadeIn 600ms ease' }}>
            <p className="italic" style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: '1.15rem', lineHeight: 1.65, color: '#2a1f15' }}>
              This is a quiet place. A collection of anonymous moments — small ones, mostly — from people who found something good and wanted to leave it here.
            </p>
            <p className="mt-6" style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: '1.05rem', lineHeight: 1.65, color: '#3a2d20' }}>
              If you are having a hard time, the hope is that reading these reminds you that you have moments like this too, tucked away — and that more are coming, even when you can't see them yet.
            </p>
            <p className="mt-6" style={{ fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: '1.05rem', lineHeight: 1.65, color: '#3a2d20' }}>
              If you are carrying something heavier than a bad day, please reach out to a person who can help. In the US, call or text <strong style={{ fontWeight: 500 }}>988</strong>. Elsewhere, <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer" style={{ color: '#2a1f15', textDecoration: 'underline' }}>findahelpline.com</a>. You deserve that kind of care.
            </p>
            <div className="mt-10" style={{ fontFamily: "'Fraunces', serif", color: '#c4a87a', fontSize: '1rem', letterSpacing: '0.4em', textAlign: 'center' }}>·  ·  ·</div>
          </div>
        )}
      </main>

      <footer
        className="w-full px-6 pb-6 pt-2 text-center"
        style={{ fontFamily: "'Karla', sans-serif", fontSize: '0.65rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#a89680' }}
      >
        {count > 0 && `${count} moments`}
      </footer>
    </div>
  );
}

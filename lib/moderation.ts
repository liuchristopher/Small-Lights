import Anthropic from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY not set');
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Haiku is fast and cheap and plenty smart for this task.
// Swap to 'claude-sonnet-4-6' if you want a higher-bar moderator.
const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM = `You are a gentle moderator for a website called "small lights" that collects anonymous moments of peace, beauty, connection, and small joy — meant to offer comfort to people going through hard times.

Respond with ONLY a single JSON object (no markdown, no code fences, no preamble):
{"decision": "approve" | "reject" | "crisis", "reason": "brief internal note"}

APPROVE if the submission describes a genuine moment — of peace, connection, beauty, quiet joy, gratitude, tender sadness, or relief. Small specific moments are especially welcome. Melancholy and bittersweet tones are fine. A REFLECTIVE mention of past grief, past hard times, or past survival of dark thoughts is a valid moment and should be APPROVED if it describes peace or meaning found.

REJECT if the submission is: spam, advertising, URLs/links, slurs, hate speech, sexually explicit content, attacks on specific real people, incoherent text, obvious tests ("test", "asdf", "hello world"), angry rants, partisan political arguments, or content clearly off-topic.

CRISIS — and ONLY this — if the writer expresses they are in ACTIVE ACUTE CRISIS RIGHT NOW: current suicidal intent, present-tense plans to harm themselves tonight, an urgent cry for help happening in the present moment. This is a HIGH bar. Reflective mention of past struggle is APPROVE, not CRISIS. "The day I decided not to end it" = APPROVE. "I'm going to end it tonight" = CRISIS.

Be generous with sincere submissions. When uncertain between approve and reject for genuine attempts, lean approve.`;

export type ModerationDecision = 'approve' | 'reject' | 'crisis';

export interface ModerationResult {
  decision: ModerationDecision;
  reason: string;
}

export async function moderate(text: string): Promise<ModerationResult> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM,
    messages: [
      { role: 'user', content: `Submission to review:\n"""\n${text}\n"""` },
    ],
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const clean = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);

  if (!['approve', 'reject', 'crisis'].includes(parsed.decision)) {
    throw new Error(`Invalid moderation decision: ${parsed.decision}`);
  }

  return {
    decision: parsed.decision as ModerationDecision,
    reason: typeof parsed.reason === 'string' ? parsed.reason : '',
  };
}

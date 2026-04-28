import { NextRequest, NextResponse } from 'next/server';
import { recordHookEvent, getSnapshot, type HookPayload } from '@/lib/agentActivityStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── POST: Claude Code hook이 호출 ──────────────────────
export async function POST(req: NextRequest) {
  const expected = process.env.AGENT_OFFICE_TOKEN;
  if (expected) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  let payload: HookPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const eventName =
    req.headers.get('x-hook-event') ||
    payload.hook_event_name ||
    payload.hook_event ||
    'PreToolUse';

  recordHookEvent(eventName, payload);

  return NextResponse.json({ ok: true });
}

// ─── GET: 프론트엔드가 폴링 ─────────────────────────────
export async function GET() {
  const snapshot = getSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

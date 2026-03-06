import { execSync } from 'child_process';
import { NextResponse } from 'next/server';

export async function GET() {
  const results: Record<string, string> = {};

  const commands = [
    'ls -la /usr/bin/chromium',
    '/usr/bin/chromium --version',
    '/usr/bin/chromium --headless --no-sandbox --dump-dom about:blank 2>&1 | head -5',
    'ldd /usr/bin/chromium 2>&1 | grep "not found"',
  ];

  for (const cmd of commands) {
    try {
      results[cmd] = execSync(cmd, { timeout: 10000 }).toString().trim();
    } catch (e: any) {
      results[cmd] = 'ERROR: ' + e.message;
    }
  }

  return NextResponse.json(results);
}

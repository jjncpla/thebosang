import { execSync } from 'child_process';
import { NextResponse } from 'next/server';

export async function GET() {
  const results: Record<string, string> = {};

  const commands = [
    'find / -name "chromium" -type f 2>/dev/null | head -10',
    'find / -name "chrome" -type f 2>/dev/null | head -10',
    'find / -name "chromium-browser" -type f 2>/dev/null | head -10',
    'ls /usr/bin/ | grep -i chrom',
    'ls /usr/bin/ | grep -i google',
    'cat /etc/os-release',
  ];

  for (const cmd of commands) {
    try {
      results[cmd] = execSync(cmd, { timeout: 5000 }).toString().trim();
    } catch (e: any) {
      results[cmd] = 'ERROR: ' + e.message;
    }
  }

  return NextResponse.json(results);
}

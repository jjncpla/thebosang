import { execSync } from 'child_process';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const which = execSync('which chromium || which chromium-browser || which google-chrome || which google-chrome-stable || find /usr -name "chromium*" 2>/dev/null | head -5').toString();
    return NextResponse.json({ result: which });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}

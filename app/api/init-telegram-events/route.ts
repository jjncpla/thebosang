import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = process.env.ADMIN_INIT_TOKEN;

  if (!token || authHeader !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return new Promise<NextResponse>((resolve) => {
    exec(
      "npx prisma db push --accept-data-loss=false",
      { cwd: process.cwd() },
      (error, stdout, stderr) => {
        if (error) {
          console.error("[init-telegram-events] db push error:", stderr || error.message);
          resolve(
            NextResponse.json(
              { success: false, error: stderr || error.message },
              { status: 500 }
            )
          );
        } else {
          resolve(
            NextResponse.json({ success: true, message: "Schema synced", output: stdout })
          );
        }
      }
    );
  });
}

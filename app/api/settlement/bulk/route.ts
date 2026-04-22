import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const items = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items must be a non-empty array" }, { status: 400 });
    }

    const created = await (prisma as any).settlementTracker.createMany({ data: items });
    return NextResponse.json({ count: created.count }, { status: 201 });
  } catch (err: any) {
    console.error("[settlement/bulk POST]", err);
    return NextResponse.json({ error: err.message ?? "DB error" }, { status: 500 });
  }
}

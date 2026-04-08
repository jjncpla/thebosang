import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { progressStatus } = await req.json();
  if (!progressStatus) return NextResponse.json({ error: "progressStatus required" }, { status: 400 });

  const result = await prisma.objectionCase.deleteMany({ where: { progressStatus } });
  return NextResponse.json({ deleted: result.count });
}

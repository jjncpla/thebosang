import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET: 이유서 내용 조회
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const objCase = await prisma.objectionCase.findUnique({
    where: { id },
    select: { reasonContent: true },
  });

  return NextResponse.json({ reasonContent: objCase?.reasonContent ?? "" });
}

// PATCH: 이유서 내용 저장
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { reasonContent } = await req.json();

  const updated = await prisma.objectionCase.update({
    where: { id },
    data: { reasonContent },
  });

  return NextResponse.json({ ok: true, reasonContent: updated.reasonContent });
}

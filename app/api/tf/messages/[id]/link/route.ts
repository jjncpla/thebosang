import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { linkedCaseId } = await req.json();

  const updated = await prisma.telegramMessage.update({
    where: { id },
    data: {
      linkedCaseId: linkedCaseId || null,
      isProcessed: true,
    },
  });

  return NextResponse.json(updated);
}

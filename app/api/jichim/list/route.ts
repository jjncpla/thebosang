import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const docs = await prisma.jichimDocument.findMany({
    select: { itemId: true, title: true, updatedAt: true },
  });

  const itemIds = docs.map((d: { itemId: string }) => d.itemId);
  return NextResponse.json(itemIds);
}

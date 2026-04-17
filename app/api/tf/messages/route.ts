import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const tfName = searchParams.get("tfName");
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  if (!tfName) return NextResponse.json({ error: "tfName required" }, { status: 400 });

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);

  const messages = await prisma.tfMessage.findMany({
    where: {
      tfName,
      sentAt: { gte: from, lt: to },
    },
    orderBy: { sentAt: "asc" },
  });

  return NextResponse.json(messages);
}

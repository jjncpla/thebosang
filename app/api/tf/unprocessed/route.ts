import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const tfName = searchParams.get("tf");

  const where = {
    isProcessed: false,
    ...(tfName ? { tfName } : {}),
  };

  const count = await prisma.telegramMessage.count({ where });
  return NextResponse.json({ count });
}

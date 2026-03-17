import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { authPrisma } from "@/lib/auth-db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await authPrisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}

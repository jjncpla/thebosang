import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { authPrisma } from "@/lib/auth-db";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const { action } = await req.json();
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action은 approve 또는 reject여야 합니다." }, { status: 400 });
  }
  const updated = await authPrisma.signupRequest.update({
    where: { id },
    data: { status: action === "approve" ? "APPROVED" : "REJECTED" },
  });
  return NextResponse.json(updated);
}

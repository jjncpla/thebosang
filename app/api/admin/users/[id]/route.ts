import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { authPrisma } from "@/lib/auth-db";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const mainUser = await prisma.user.findUnique({
    where: { id },
    select: { licenseNo: true, birthDate: true, officeAddress: true, officeTel: true, officeFax: true, branchName: true, regionName: true, department: true, jobTitle: true },
  });
  return NextResponse.json(mainUser ?? {});
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const { role, licenseNo, birthDate, officeAddress, officeTel, officeFax, branchName, regionName, department, jobTitle } = body;

  // auth DB: role 업데이트
  if (role !== undefined) {
    await authPrisma.user.update({ where: { id }, data: { role } });
  }

  // main DB: 노무사 전문 정보 업데이트 (upsert — main DB에 없을 수도 있음)
  const professionalFields = { licenseNo, birthDate, officeAddress, officeTel, officeFax, branchName, regionName, department, jobTitle };
  const hasProfessional = Object.values(professionalFields).some((v) => v !== undefined);
  if (hasProfessional) {
    const authUser = await authPrisma.user.findUnique({ where: { id }, select: { email: true, name: true, role: true } });
    if (authUser) {
      await prisma.user.upsert({
        where: { id },
        update: Object.fromEntries(Object.entries(professionalFields).filter(([, v]) => v !== undefined)),
        create: {
          id,
          email: authUser.email,
          password: "__auth_managed__",
          name: authUser.name,
          role: authUser.role,
          ...Object.fromEntries(Object.entries(professionalFields).filter(([, v]) => v !== undefined)),
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "자기 자신은 삭제할 수 없습니다." }, { status: 400 });
  }
  await authPrisma.user.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}

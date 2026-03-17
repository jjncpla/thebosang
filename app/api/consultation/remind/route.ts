import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  const threeWeeksAgo = new Date(today);
  threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);

  // 연락대기 상태인 모든 상담 조회
  const waiting = await prisma.consultation.findMany({
    where: { status: "연락대기" },
    orderBy: { updatedAt: "asc" },
  });

  const targets = waiting.filter((c) => {
    if (c.reminderDate) {
      // 알림 지정일이 오늘이면 대상
      const rd = new Date(c.reminderDate);
      rd.setHours(0, 0, 0, 0);
      return rd.getTime() === today.getTime();
    } else {
      // 마지막 업데이트로부터 21일 경과
      return c.updatedAt <= threeWeeksAgo;
    }
  });

  console.log(`[ConsultationRemind] 알림 대상: ${targets.length}건`);

  return NextResponse.json({
    count: targets.length,
    items: targets.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      updatedAt: c.updatedAt,
      reminderDate: c.reminderDate,
    })),
  });
}

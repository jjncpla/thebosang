import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? (session.user as { id?: string }).id ?? "";
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const todos = await prisma.todo.findMany({
    where: {
      assignedTo: userId,
      dueDate: { gte: startDate, lte: endDate },
    },
    select: { isDone: true, type: true },
  });

  const total = todos.length;
  const done = todos.filter((t) => t.isDone).length;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;

  const byType: Record<string, { total: number; done: number }> = {
    OBJECTION_DEADLINE: { total: 0, done: 0 },
    WAGE_REQUEST: { total: 0, done: 0 },
    GENERAL: { total: 0, done: 0 },
  };
  for (const t of todos) {
    const key = t.type as string;
    if (byType[key]) {
      byType[key].total++;
      if (t.isDone) byType[key].done++;
    }
  }

  // 관리자용: 전체 사용자 수행율
  const role = (session.user as { role?: string }).role ?? "";
  let allUsers = null;
  if (["ADMIN", "SENIOR_MANAGER"].includes(role)) {
    const userStats = await prisma.todo.groupBy({
      by: ["assignedTo"],
      where: {
        dueDate: { gte: startDate, lte: endDate },
        assignedTo: { not: null },
      },
      _count: { id: true },
    });

    const doneStats = await prisma.todo.groupBy({
      by: ["assignedTo"],
      where: {
        dueDate: { gte: startDate, lte: endDate },
        assignedTo: { not: null },
        isDone: true,
      },
      _count: { id: true },
    });

    const doneMap = new Map(doneStats.map((d) => [d.assignedTo, d._count.id]));
    const userIds = userStats.map((u) => u.assignedTo!).filter(Boolean);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    allUsers = userStats.map((u) => {
      const totalCount = u._count.id;
      const doneCount = doneMap.get(u.assignedTo) ?? 0;
      return {
        userId: u.assignedTo,
        name: userMap.get(u.assignedTo!) ?? "알 수 없음",
        total: totalCount,
        done: doneCount,
        rate: Math.round((doneCount / totalCount) * 100),
      };
    }).sort((a, b) => b.rate - a.rate);
  }

  return NextResponse.json({ userId, year, month, total, done, rate, byType, allUsers });
}

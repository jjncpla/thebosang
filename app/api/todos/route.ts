import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET: 내 할일 목록 조회
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const done = searchParams.get("done");

  const todos = await prisma.todo.findMany({
    where: {
      assignedTo: session.user.id,
      ...(type ? { type } : {}),
      ...(done !== null ? { isDone: done === "true" } : {}),
    },
    orderBy: { dueDate: "asc" },
  });

  return NextResponse.json(todos);
}

// POST: 할일 생성
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, dueDate, type, caseId, patientName, memo } = body;

  const todo = await prisma.todo.create({
    data: {
      title,
      dueDate: dueDate ? new Date(dueDate) : null,
      type: type ?? "GENERAL",
      caseId: caseId ?? null,
      patientName: patientName ?? null,
      assignedTo: session.user.id,
      memo: memo ?? null,
    },
  });

  return NextResponse.json(todo);
}

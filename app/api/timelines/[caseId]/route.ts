import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// ✅ GET
export async function GET(
  req: NextRequest,
  { params }: { params: { caseId: string } }
) {
  const { caseId } = params;

  if (!caseId) {
    return NextResponse.json({ error: "caseId 없음" }, { status: 400 });
  }

  const timelines = await prisma.timelineEvent.findMany({
    where: {
      caseId: Number(caseId),
    },
    orderBy: {
      date: "asc", // 🔥 이거 추가 (중요)
    },
  });

  return NextResponse.json(timelines);
}

// ✅ POST
export async function POST(
  req: NextRequest,
  { params }: { params: { caseId: string } }
) {
  const { caseId } = params;
  const body = await req.json();

  const data = await prisma.timelineEvent.create({
    data: {
      caseId: Number(caseId),
      title: body.title,
      date: new Date(body.date),
    },
  });

  console.log("POST 들어옴", body);

  return NextResponse.json(data);
}
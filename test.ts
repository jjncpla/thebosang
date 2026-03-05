import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
  try {
    const result = await prisma.message.create({
      data: {
        messageId: Date.now(),
        chatId: BigInt(123),
        userId: BigInt(456),
        text: "테스트 메시지",
        type: "text",
        createdAt: new Date(),
      },
    });

    console.log("저장 성공:", result);
  } catch (e) {
    console.error("에러:", e);
  } finally {
    await prisma.$disconnect();
  }
}
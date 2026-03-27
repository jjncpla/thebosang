import { prisma } from "../lib/prisma";

async function main() {
  console.log("Starting sample data seeding...");

  // 1. Create Consultation
  const cons1 = await prisma.consultation.create({
    data: {
      name: "홍길동",
      ssn: "700101-1234567",
      phone: "010-1234-5678",
      caseTypes: ["HEARING_LOSS"],
      status: "진행중",
      tfName: "울산동부TF",
      branchName: "울산",
    },
  });
  console.log("Created Consultation:", cons1.name);

  // 2. Create Patient
  const patient1 = await prisma.patient.create({
    data: {
      name: "김철수",
      ssn: "600505-1111111",
      phone: "010-9999-8888",
      address: "울산광역시 동구",
    },
  });

  // 3. Create Case
  const case1 = await prisma.case.create({
    data: {
      patientId: patient1.id,
      caseType: "HEARING_LOSS",
      status: "IN_EXAM",
      tfName: "울산남부TF",
      branch: "울산",
    },
  });
  console.log("Created Case for", patient1.name);

  // 4. Create HearingLossDetail
  await prisma.hearingLossDetail.create({
    data: {
      caseId: case1.id,
      firstClinic: "울산대학교병원",
      firstExamDate: new Date(),
    },
  });

  const patient2 = await prisma.patient.create({
    data: {
      name: "이영희",
      ssn: "650707-2222222",
      phone: "010-7777-6666",
    },
  });

  const case2 = await prisma.case.create({
    data: {
      patientId: patient2.id,
      caseType: "HEARING_LOSS",
      status: "REJECTED",
      tfName: "울산북부TF",
      branch: "울산",
    },
  });

  await prisma.hearingLossDetail.create({
    data: {
      caseId: case2.id,
      decisionType: "REJECTED",
      decisionReceivedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30일 전
    },
  });

  // 5. Create ObjectionReview
  const review1 = await prisma.objectionReview.create({
    data: {
      caseId: case2.id,
      tfName: "울산북부TF",
      patientName: "이영희",
      caseType: "HEARING_LOSS",
      approvalStatus: "불승인",
      progressStatus: "이의제기 진행",
      decisionDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  });
  console.log("Created ObjectionReview for", patient2.name);

  // 6. Create ObjectionCase
  await prisma.objectionCase.create({
    data: {
      reviewId: review1.id,
      caseId: case2.id,
      tfName: "울산북부TF",
      patientName: "이영희",
      caseType: "HEARING_LOSS",
      approvalStatus: "불승인",
      decisionDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      progressStatus: "진행중",
      litigationHandover: false,
    },
  });
  console.log("Created ObjectionCase for", patient2.name);

  // 7. Create WageReviewData
  await prisma.wageReviewData.create({
    data: {
      caseId: case2.id,
      tfName: "울산북부TF",
      patientName: "이영희",
      caseType: "HEARING_LOSS",
    },
  });
  console.log("Created WageReviewData for", patient2.name);

  console.log("Sample data seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

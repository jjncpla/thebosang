"use client";

import { use } from "react";
import CopdCaseDetailInline from "@/components/copd/CopdCaseDetailInline";

export default function CopdDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = use(params);
  return <CopdCaseDetailInline caseId={caseId} />;
}

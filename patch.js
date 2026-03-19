const fs = require('fs');
let content = fs.readFileSync('app/patients/[patientId]/page.tsx', 'utf8');
let lines = content.split('\n');

const typesStart = lines.findIndex(l => l.startsWith('type WorkHistoryItem = {'));
const typesEnd = lines.findIndex((l, i) => i > typesStart && l.startsWith('type HearingLossExam = {'));

if (typesStart !== -1 && typesEnd !== -1) {
    lines.splice(typesStart, typesEnd - typesStart,
        'import { WorkHistorySection } from "@/components/case-common/WorkHistorySection";',
        'import type { WorkHistoryItem, WorkHistoryRawEntry, WorkHistoryRaw } from "@/components/case-common/WorkHistoryTypes";',
        ''
    );
}

const handleFuncs = `
  const handleWorkHistoryChange = (updates: {
    workHistory?: WorkHistoryItem[] | null;
    workHistoryRaw?: WorkHistoryRaw | null;
    workHistoryMemo?: string | null;
    lastNoiseWorkEndDate?: string | null;
  }) => {
    setDetail((prev) => ({ ...prev, ...updates }));
  };

  const saveLastNoiseWorkEndDate = async (isoDate: string) => {
    await fetch(\`/api/cases/\${caseId}/hearing-loss\`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastNoiseWorkEndDate: isoDate }),
    });
  };
`;

const stateStart = lines.findIndex(l => l.includes('const workHistory: WorkHistoryItem[] = detail.workHistory ?? [];'));
const stateEnd = lines.findIndex((l, i) => i > stateStart && l.includes('return ('));

if (stateStart !== -1 && stateEnd !== -1) {
    lines.splice(stateStart, stateEnd - stateStart, handleFuncs);
}

const uiStart = lines.findIndex(l => l.includes('<SectionTitle>직업력</SectionTitle>'));
const uiEnd = lines.findIndex((l, i) => i > uiStart && l.includes('<div style={{ marginTop: 16 }}><SaveBar /></div>'));

const newUi = `
            <WorkHistorySection
              caseId={caseId}
              workHistory={detail.workHistory ?? []}
              workHistoryRaw={detail.workHistoryRaw ?? { 고용산재: [], 건보: [], 소득금액: [], 연금: [], 건근공: [] }}
              workHistoryMemo={detail.workHistoryMemo}
              lastNoiseWorkEndDate={detail.lastNoiseWorkEndDate}
              onChange={handleWorkHistoryChange}
              onSaveLastDate={saveLastNoiseWorkEndDate}
            />
`;

if (uiStart !== -1 && uiEnd !== -1) {
    lines.splice(uiStart, uiEnd - uiStart, newUi);
}

fs.writeFileSync('app/patients/[patientId]/page.tsx', lines.join('\n'));
console.log("Patched successfully");

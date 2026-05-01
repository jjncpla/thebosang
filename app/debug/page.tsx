/* eslint-disable @next/next/no-img-element */
// 좌표 디버그용 internal 페이지 — Next.js <Image> 대신 raw <img> 사용 (CSS positioning + 디버그 트래픽이라 LCP 무관)
'use client';

import { useRef } from 'react';

export default function DebugPage() {
  const ref = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // px → mm 변환 (A4 기준)
    const mmX = (x / rect.width) * 210;
    const mmY = (y / rect.height) * 297;

    console.log(`left: ${mmX.toFixed(2)}mm; top: ${mmY.toFixed(2)}mm;`);
  };

  return (
    <div
      ref={ref}
      onClick={handleClick}
      style={{
        width: '210mm',
        height: '297mm',
        position: 'relative',
        cursor: 'crosshair',
        border: '1px solid black',
      }}
    >
      <img
        src="/form-backgrounds/disability-claim-v1-page1.jpg"
        alt="장해급여 청구서 양식 좌표 디버그 배경"
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
    </div>
  );
}
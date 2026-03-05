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
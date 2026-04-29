"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function InlinePdfViewer({ fileUrl }: { fileUrl: string }) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* 페이지 컨트롤 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "#3c3f41", flexShrink: 0 }}>
        <button
          onClick={() => setPageNumber(p => Math.max(1, p - 1))}
          disabled={pageNumber <= 1}
          style={{ padding: "3px 10px", borderRadius: 4, border: "1px solid #666", background: "#555", color: "#ddd", cursor: "pointer", fontSize: 13 }}
        >‹</button>
        <span style={{ fontSize: 12, color: "#ccc", minWidth: 70, textAlign: "center" }}>
          {pageNumber} / {numPages || "?"}
        </span>
        <button
          onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
          disabled={pageNumber >= numPages}
          style={{ padding: "3px 10px", borderRadius: 4, border: "1px solid #666", background: "#555", color: "#ddd", cursor: "pointer", fontSize: 13 }}
        >›</button>
        <div style={{ marginLeft: 12, display: "flex", alignItems: "center", gap: 4 }}>
          <button
            onClick={() => setScale(s => Math.max(0.6, s - 0.2))}
            style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #666", background: "#555", color: "#ddd", cursor: "pointer", fontSize: 13 }}
          >−</button>
          <span style={{ fontSize: 11, color: "#ccc", minWidth: 40, textAlign: "center" }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
            style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #666", background: "#555", color: "#ddd", cursor: "pointer", fontSize: 13 }}
          >+</button>
        </div>
      </div>

      {/* PDF 본문 */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", justifyContent: "center", padding: "20px 0" }}>
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages }: { numPages: number }) => {
            setNumPages(numPages);
            setPageNumber(1);
          }}
          loading={
            <div style={{ color: "#ccc", paddingTop: 60, fontSize: 13 }}>불러오는 중...</div>
          }
          error={
            <div style={{ color: "#f87171", paddingTop: 60, fontSize: 13, textAlign: "center" }}>
              PDF를 불러올 수 없습니다.
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
}

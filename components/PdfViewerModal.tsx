"use client";

import { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Props {
  fileUrl: string;
  title: string;
  onClose: () => void;
}

export default function PdfViewerModal({ fileUrl, title, onClose }: Props) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback(() => {
    setLoading(false);
    setError(true);
  }, []);

  return (
    /* 오버레이 */
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      {/* 모달 */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 12,
          width: "90vw", maxWidth: 860, height: "90vh",
          display: "flex", flexDirection: "column",
          overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* 헤더 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderBottom: "1px solid #e5e7eb",
          background: "#f9fafb", flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827", flex: 1, marginRight: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {/* 페이지 네비 */}
            {numPages > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#6b7280" }}>
                <button
                  onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                  disabled={pageNumber <= 1}
                  style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 12, color: pageNumber <= 1 ? "#d1d5db" : "#374151" }}
                >‹</button>
                <span style={{ minWidth: 60, textAlign: "center" }}>{pageNumber} / {numPages}</span>
                <button
                  onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                  disabled={pageNumber >= numPages}
                  style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 12, color: pageNumber >= numPages ? "#d1d5db" : "#374151" }}
                >›</button>
              </div>
            )}
            {/* 줌 */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={() => setScale(s => Math.max(0.6, s - 0.2))}
                style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 12 }}
              >−</button>
              <span style={{ fontSize: 11, color: "#6b7280", minWidth: 36, textAlign: "center" }}>{Math.round(scale * 100)}%</span>
              <button
                onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
                style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 12 }}
              >+</button>
            </div>
            {/* 닫기 */}
            <button
              onClick={onClose}
              style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#fee2e2", color: "#dc2626", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
            >✕</button>
          </div>
        </div>

        {/* PDF 본문 */}
        <div style={{ flex: 1, overflowY: "auto", background: "#525659", display: "flex", justifyContent: "center", padding: "20px 0" }}>
          {error ? (
            <div style={{ color: "#fff", margin: "auto", textAlign: "center", fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
              PDF를 불러올 수 없습니다.
            </div>
          ) : (
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div style={{ color: "#ccc", margin: "auto", paddingTop: 60, fontSize: 13 }}>불러오는 중...</div>
              }
            >
              {!loading && (
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              )}
            </Document>
          )}
        </div>
      </div>
    </div>
  );
}

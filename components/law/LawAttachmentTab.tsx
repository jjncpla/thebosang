"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AttachmentLawItem = {
  id: string;
  label: string;        // "법" | "시행령" | "시행규칙"
  name: string;         // 풀 이름
};

export type AttachmentLawGroup = {
  id: string;
  groupName: string;
  laws: AttachmentLawItem[];
};

type Attachment = {
  id: string;
  lawId: string;
  attachmentType: string;
  number: string | null;
  title: string;
  description: string | null;
  fileName: string;
  contentType: string;
  fileSize: number;
  createdAt: string;
  updatedAt?: string;
};

const ATTACHMENT_TYPES = ["별표", "별지", "첨부"] as const;
const MAX_SIZE = 5 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function LawAttachmentTab({ lawGroups }: { lawGroups: AttachmentLawGroup[] }) {
  const allLaws = lawGroups.flatMap((g) => g.laws);
  const firstLaw = allLaws[0] ?? null;

  const [selectedLaw, setSelectedLaw] = useState<AttachmentLawItem | null>(firstLaw);
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<Attachment | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const load = useCallback(async () => {
    if (!selectedLaw) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/law/attachments?lawId=${encodeURIComponent(selectedLaw.id)}`);
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
      const data: Attachment[] = await res.json();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }, [selectedLaw]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (att: Attachment) => {
    if (!confirm(`"${att.title}"을(를) 삭제하시겠습니까?`)) return;
    const res = await fetch(`/api/law/attachments/${att.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("삭제 실패");
      return;
    }
    if (previewItem?.id === att.id) setPreviewItem(null);
    load();
  };

  const grouped: Record<string, Attachment[]> = {};
  for (const a of items) {
    const key = a.attachmentType;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(a);
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 160px)" }}>
      {/* Left: 법령 선택 */}
      <div
        style={{
          width: 240,
          flexShrink: 0,
          borderRight: "1px solid #e5e7eb",
          overflowY: "auto",
          background: "#f9fafb",
        }}
      >
        {lawGroups.map((g) => (
          <div key={g.id} style={{ marginBottom: 8 }}>
            <div
              style={{
                padding: "8px 12px 4px",
                fontSize: 11,
                fontWeight: 700,
                color: "#9ca3af",
                letterSpacing: "0.06em",
              }}
            >
              {g.groupName}
            </div>
            {g.laws.map((law) => {
              const active = selectedLaw?.id === law.id;
              return (
                <button
                  key={law.id}
                  onClick={() => setSelectedLaw(law)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 12px",
                    fontSize: 12,
                    border: "none",
                    background: active ? "#dbeafe" : "transparent",
                    color: active ? "#1d4ed8" : "#374151",
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                    gap: 6,
                    borderLeft: active ? "2px solid #3b82f6" : "2px solid transparent",
                  }}
                >
                  <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "#e5e7eb", color: "#4b5563", flexShrink: 0 }}>
                    {law.label}
                  </span>
                  <span>{law.name}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Right: 별표 목록 + 미리보기 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <div
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid #e5e7eb",
            background: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
            {selectedLaw?.name ?? "법령을 선택하세요"}
          </div>
          <div style={{ fontSize: 11, color: "#6b7280" }}>
            {items.length}건
          </div>
          <button
            onClick={() => setShowUpload(true)}
            disabled={!selectedLaw}
            style={{
              marginLeft: "auto",
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              borderRadius: 5,
              background: selectedLaw ? "#1d4ed8" : "#9ca3af",
              color: "#fff",
              cursor: selectedLaw ? "pointer" : "not-allowed",
            }}
          >
            + 별표·첨부 업로드
          </button>
        </div>

        {/* Body: 좌(목록) + 우(미리보기) */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* 목록 */}
          <div style={{ width: previewItem ? 360 : "100%", borderRight: previewItem ? "1px solid #e5e7eb" : "none", overflowY: "auto", background: "#fff", flexShrink: 0 }}>
            {error && (
              <div style={{ padding: 12, color: "#dc2626", fontSize: 12 }}>⚠ {error}</div>
            )}
            {loading && (
              <div style={{ padding: 16, color: "#9ca3af", fontSize: 12 }}>불러오는 중…</div>
            )}
            {!loading && items.length === 0 && !error && (
              <div style={{ padding: "32px 16px", color: "#9ca3af", fontSize: 13, textAlign: "center" }}>
                등록된 별표·첨부가 없습니다
              </div>
            )}
            {!loading && Object.keys(grouped).length > 0 && (
              <div>
                {ATTACHMENT_TYPES.filter((t) => grouped[t]?.length).map((type) => (
                  <div key={type}>
                    <div style={{ padding: "8px 14px 4px", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.06em", background: "#f9fafb" }}>
                      {type} ({grouped[type].length})
                    </div>
                    {grouped[type].map((att) => {
                      const active = previewItem?.id === att.id;
                      return (
                        <div
                          key={att.id}
                          onClick={() => setPreviewItem(att)}
                          style={{
                            padding: "10px 14px",
                            borderBottom: "1px solid #f3f4f6",
                            cursor: "pointer",
                            background: active ? "#eff6ff" : "#fff",
                            borderLeft: active ? "3px solid #3b82f6" : "3px solid transparent",
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 2 }}>
                            {att.number && <span style={{ color: "#1d4ed8", marginRight: 6 }}>{att.number}</span>}
                            {att.title}
                          </div>
                          <div style={{ fontSize: 10, color: "#9ca3af", display: "flex", gap: 8, alignItems: "center" }}>
                            <span>{att.fileName}</span>
                            <span>·</span>
                            <span>{formatBytes(att.fileSize)}</span>
                            <span>·</span>
                            <span>{formatDate(att.createdAt)}</span>
                          </div>
                          {att.description && (
                            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>{att.description}</div>
                          )}
                          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                            <a
                              href={`/api/law/attachments/${att.id}/file`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ fontSize: 10, color: "#3b82f6", textDecoration: "none" }}
                            >
                              다운로드
                            </a>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(att); }}
                              style={{ fontSize: 10, color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 미리보기 */}
          {previewItem && (
            <PreviewPane
              item={previewItem}
              onClose={() => setPreviewItem(null)}
            />
          )}
        </div>
      </div>

      {showUpload && selectedLaw && (
        <UploadModal
          law={selectedLaw}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Preview pane ───────────────────────────────────────────────────────────
function PreviewPane({ item, onClose }: { item: Attachment; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // 일부 브라우저는 cross-origin이 아니어도 PDF iframe.print 차단 → 새창으로 폴백
      window.open(`/api/law/attachments/${item.id}/file?inline=1`, "_blank");
    }
  };

  const isImage = item.contentType.startsWith("image/");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#525659" }}>
      <div style={{ padding: "8px 12px", background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {item.number && <span style={{ color: "#1d4ed8", marginRight: 6 }}>{item.number}</span>}
          {item.title}
        </div>
        <button
          onClick={handlePrint}
          style={{ padding: "4px 12px", fontSize: 12, fontWeight: 600, border: "1px solid #d1d5db", borderRadius: 5, background: "#fff", color: "#374151", cursor: "pointer" }}
        >
          🖨 인쇄
        </button>
        <a
          href={`/api/law/attachments/${item.id}/file`}
          style={{ padding: "4px 12px", fontSize: 12, fontWeight: 600, border: "1px solid #d1d5db", borderRadius: 5, background: "#fff", color: "#374151", textDecoration: "none" }}
        >
          ⬇ 저장
        </a>
        <button
          onClick={onClose}
          style={{ padding: "4px 8px", fontSize: 12, border: "none", background: "none", color: "#6b7280", cursor: "pointer" }}
        >
          ✕
        </button>
      </div>
      <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", alignItems: isImage ? "center" : "stretch" }}>
        {isImage ? (
          // 첨부파일 modal 미리보기 — API endpoint 동적 src, modal 트래픽이라 LCP 무관
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/law/attachments/${item.id}/file?inline=1`}
            alt={item.title}
            style={{ maxWidth: "100%", maxHeight: "100%", background: "#fff" }}
          />
        ) : (
          <iframe
            ref={iframeRef}
            src={`/api/law/attachments/${item.id}/file?inline=1`}
            style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
            title={item.title}
          />
        )}
      </div>
    </div>
  );
}

// ─── Upload modal ───────────────────────────────────────────────────────────
function UploadModal({
  law,
  onClose,
  onUploaded,
}: {
  law: AttachmentLawItem;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<typeof ATTACHMENT_TYPES[number]>("별표");
  const [number, setNumber] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("PDF 파일을 선택하세요"); return; }
    if (file.size > MAX_SIZE) { setError(`파일은 ${MAX_SIZE / 1024 / 1024}MB 이하여야 합니다`); return; }
    if (!title.trim()) { setError("제목을 입력하세요"); return; }

    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("lawId", law.id);
    fd.append("attachmentType", type);
    fd.append("number", number);
    fd.append("title", title);
    fd.append("description", description);

    try {
      const res = await fetch("/api/law/attachments", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "업로드 실패");
      }
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "#fff", borderRadius: 10, padding: 24, width: 480, maxWidth: "90vw" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
          별표·첨부 업로드
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
          {law.name}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof ATTACHMENT_TYPES[number])}
              style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 5, width: 90 }}
            >
              {ATTACHMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              type="text"
              placeholder="번호 (예: 별표 1, 별지 제2호서식)"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              style={{ flex: 1, padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 5 }}
            />
          </div>
          <input
            type="text"
            placeholder="제목 *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 5 }}
          />
          <textarea
            placeholder="설명 (선택)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 5, resize: "vertical", minHeight: 50 }}
          />

          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            style={{ padding: "10px 12px", fontSize: 13, border: "2px dashed #d1d5db", borderRadius: 6, background: "#f9fafb", color: "#6b7280", cursor: "pointer", textAlign: "left" }}
          >
            {fileName || "PDF / PNG / JPEG 파일 선택…"}
          </button>

          {error && (
            <div style={{ fontSize: 12, color: "#dc2626" }}>{error}</div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          <button
            onClick={onClose}
            disabled={uploading}
            style={{ padding: "8px 16px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 5, background: "#fff", color: "#374151", cursor: "pointer" }}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading}
            style={{ padding: "8px 16px", fontSize: 13, border: "none", borderRadius: 5, background: uploading ? "#9ca3af" : "#1d4ed8", color: "#fff", cursor: uploading ? "not-allowed" : "pointer", fontWeight: 600 }}
          >
            {uploading ? "업로드 중…" : "업로드"}
          </button>
        </div>
      </div>
    </div>
  );
}

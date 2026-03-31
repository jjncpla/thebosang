"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ───
type NasConfig = { nasUrl: string; nasRootPath: string };
type ConnectionStatus = "idle" | "testing" | "connected" | "failed";
type ScanFolder = {
  folderName: string;
  parsedName: string;
  parsedDate: string;
  parsedRegion: string;
  nasPath: string;
  status: "AUTO" | "CONFLICT" | "NOT_FOUND";
  candidates: { patientId: string; patientName: string; caseId: string; caseType: string; branch: string }[];
  matchedPatientId?: string;
  matchedCaseId?: string;
};
type MappedFile = {
  id: string;
  caseId: string;
  fileName: string;
  nasPath: string;
  uploadedAt: string;
  patient: { name: string };
  caseType: string;
  branch: string;
};

// ─── Tabs ───
const TABS = ["NAS 설정", "폴더 스캔", "매핑 현황"] as const;
type Tab = (typeof TABS)[number];

export default function CaseDbPage() {
  const [activeTab, setActiveTab] = useState<Tab>("NAS 설정");

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", marginBottom: 24 }}>사건 DB</h1>

      {/* ── Section 1: RAG Placeholder ── */}
      <div
        style={{
          background: "#f1f5f9",
          borderRadius: 12,
          padding: 32,
          marginBottom: 24,
          opacity: 0.7,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 20 }}>🔍</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#64748b" }}>AI 자료검색 — 준비 중</span>
        </div>
        <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 16px" }}>
          구글 드라이브 기반 자연어 검색 기능이 추가될 예정입니다.
        </p>
        <div
          style={{
            background: "#e2e8f0",
            borderRadius: 8,
            padding: "10px 16px",
            color: "#94a3b8",
            fontSize: 14,
            cursor: "not-allowed",
          }}
        >
          검색어를 입력하세요...
        </div>
      </div>

      {/* ── Section 2: NAS 파일 연동 ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        {/* Tab Bar */}
        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0" }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: "12px 16px",
                border: "none",
                borderBottom: activeTab === tab ? "2px solid #006838" : "2px solid transparent",
                background: activeTab === tab ? "#f0fdf4" : "transparent",
                color: activeTab === tab ? "#006838" : "#64748b",
                fontWeight: activeTab === tab ? 600 : 400,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div style={{ padding: 24 }}>
          {activeTab === "NAS 설정" && <NasSettingsTab />}
          {activeTab === "폴더 스캔" && <FolderScanTab />}
          {activeTab === "매핑 현황" && <MappingStatusTab />}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// NAS 설정 탭
// ──────────────────────────────────────────────
function NasSettingsTab() {
  const [config, setConfig] = useState<NasConfig & { nasAccount: string; nasPassword: string }>({ nasUrl: "", nasRootPath: "", nasAccount: "", nasPassword: "" });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/system-config?keys=NAS_URL,NAS_ROOT_PATH,NAS_ACCOUNT")
      .then((r) => r.json())
      .then((data) => {
        if (data.configs) {
          const map: Record<string, string> = {};
          data.configs.forEach((c: { key: string; value: string }) => (map[c.key] = c.value));
          setConfig({ nasUrl: map.NAS_URL || "", nasRootPath: map.NAS_ROOT_PATH || "", nasAccount: map.NAS_ACCOUNT || "", nasPassword: "" });
        }
      })
      .catch(() => {});
  }, []);

  const testConnection = async () => {
    if (!config.nasUrl) return;
    setConnectionStatus("testing");
    try {
      // 1) 현재 입력값 사용, 비밀번호 미입력 시 서버에서 조회
      let account = config.nasAccount;
      let password = config.nasPassword;

      if (!account || !password) {
        const credRes = await fetch("/api/system-config?keys=NAS_ACCOUNT,NAS_PASSWORD");
        const credData = await credRes.json();
        const credMap: Record<string, string> = {};
        (credData.configs || []).forEach((c: { key: string; value: string }) => (credMap[c.key] = c.value));
        if (!account) account = credMap.NAS_ACCOUNT || "";
        if (!password) password = credMap.NAS_PASSWORD || "";
      }

      if (!account || !password) {
        setConnectionStatus("failed");
        setMessage("NAS 계정 정보를 입력하거나 저장해주세요.");
        return;
      }

      // 2) 프록시를 통해 NAS API 호출 (CORS 우회)
      const proxyRes = await fetch("/api/nas/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nasUrl: config.nasUrl, account, password, action: "test" }),
      });
      const proxyData = await proxyRes.json();
      const ok = proxyData?.success === true;

      setConnectionStatus(ok ? "connected" : "failed");
      setMessage(ok ? "연결 성공" : proxyData?.error || "로그인 실패 — 계정 정보를 확인하세요.");
    } catch {
      setConnectionStatus("failed");
      setMessage("연결 테스트 실패 — NAS에 접근할 수 없습니다.");
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await fetch("/api/system-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configs: [
            { key: "NAS_URL", value: config.nasUrl },
            { key: "NAS_ROOT_PATH", value: config.nasRootPath },
            { key: "NAS_ACCOUNT", value: config.nasAccount },
            ...(config.nasPassword ? [{ key: "NAS_PASSWORD", value: config.nasPassword }] : []),
          ],
        }),
      });
      setMessage("설정이 저장되었습니다.");
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      {/* NAS URL */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
          NAS QuickConnect URL
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={config.nasUrl}
            onChange={(e) => setConfig((c) => ({ ...c, nasUrl: e.target.value }))}
            placeholder="https://quickconnect.to/thebosang"
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: 13,
            }}
          />
          <button
            onClick={testConnection}
            disabled={connectionStatus === "testing"}
            style={{
              padding: "8px 16px",
              background: "#006838",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
              opacity: connectionStatus === "testing" ? 0.6 : 1,
            }}
          >
            {connectionStatus === "testing" ? "테스트 중..." : "연결 테스트"}
          </button>
        </div>
        {connectionStatus === "connected" && (
          <span style={{ color: "#16a34a", fontSize: 12, marginTop: 4, display: "inline-block" }}>
            ✅ 연결됨
          </span>
        )}
        {connectionStatus === "failed" && (
          <span style={{ color: "#dc2626", fontSize: 12, marginTop: 4, display: "inline-block" }}>
            ❌ 연결 실패 {message && `— ${message}`}
          </span>
        )}
      </div>

      {/* NAS Account */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
          NAS 계정
        </label>
        <input
          value={config.nasAccount}
          onChange={(e) => setConfig((c) => ({ ...c, nasAccount: e.target.value }))}
          placeholder="시놀로지 로그인 계정"
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 13,
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* NAS Password */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
          NAS 비밀번호
        </label>
        <input
          type="password"
          value={config.nasPassword}
          onChange={(e) => setConfig((c) => ({ ...c, nasPassword: e.target.value }))}
          placeholder="시놀로지 로그인 비밀번호"
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 13,
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* NAS Root Path */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
          NAS 기준 루트 경로
        </label>
        <input
          value={config.nasRootPath}
          onChange={(e) => setConfig((c) => ({ ...c, nasRootPath: e.target.value }))}
          placeholder="/최초요양신청/소음성난청"
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            fontSize: 13,
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Save */}
      <button
        onClick={saveConfig}
        disabled={saving}
        style={{
          padding: "10px 24px",
          background: "#334155",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          fontSize: 13,
          cursor: "pointer",
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "저장 중..." : "설정 저장"}
      </button>

      {message && !connectionStatus.match(/connected|failed/) && (
        <span style={{ color: "#16a34a", fontSize: 12, marginLeft: 12 }}>{message}</span>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 폴더 스캔 탭
// ──────────────────────────────────────────────
function FolderScanTab() {
  const [scanning, setScanning] = useState(false);
  const [folders, setFolders] = useState<ScanFolder[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<"ALL" | "AUTO" | "CONFLICT" | "NOT_FOUND">("ALL");
  const [confirming, setConfirming] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>({}); // folderName → caseId
  const [message, setMessage] = useState("");

  const startScan = async () => {
    setScanning(true);
    setMessage("");
    try {
      const cfgRes = await fetch("/api/system-config?keys=NAS_URL,NAS_ROOT_PATH");
      const cfgData = await cfgRes.json();
      const map: Record<string, string> = {};
      (cfgData.configs || []).forEach((c: { key: string; value: string }) => (map[c.key] = c.value));

      if (!map.NAS_URL || !map.NAS_ROOT_PATH) {
        setMessage("NAS 설정을 먼저 완료해주세요.");
        setScanning(false);
        return;
      }

      const res = await fetch("/api/nas/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nasUrl: map.NAS_URL, rootPath: map.NAS_ROOT_PATH }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage(data.error);
      } else {
        setFolders(data.folders || []);
        setTotal(data.total || 0);
      }
    } catch {
      setMessage("스캔 오류가 발생했습니다.");
    } finally {
      setScanning(false);
    }
  };

  const confirmMappings = async () => {
    setConfirming(true);
    setMessage("");
    try {
      // Auto-matched + manually selected
      const mappings = folders
        .filter((f) => f.status === "AUTO" || (f.status === "CONFLICT" && selections[f.folderName]))
        .map((f) => ({
          caseId: f.status === "AUTO" ? f.matchedCaseId : selections[f.folderName],
          folderName: f.folderName,
          nasPath: f.nasPath,
        }))
        .filter((m) => m.caseId);

      if (mappings.length === 0) {
        setMessage("매핑할 항목이 없습니다.");
        setConfirming(false);
        return;
      }

      const res = await fetch("/api/nas/mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage(data.error);
      } else {
        setMessage(`${data.createdCount}건 매핑 완료`);
        // Remove confirmed items from list
        const confirmedFolders = new Set(mappings.map((m) => m.folderName));
        setFolders((prev) => prev.filter((f) => !confirmedFolders.has(f.folderName)));
      }
    } catch {
      setMessage("매핑 확정 오류");
    } finally {
      setConfirming(false);
    }
  };

  const filtered = filter === "ALL" ? folders : folders.filter((f) => f.status === filter);
  const autoCnt = folders.filter((f) => f.status === "AUTO").length;
  const conflictCnt = folders.filter((f) => f.status === "CONFLICT").length;
  const notFoundCnt = folders.filter((f) => f.status === "NOT_FOUND").length;

  return (
    <div>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          onClick={startScan}
          disabled={scanning}
          style={{
            padding: "10px 20px",
            background: "#006838",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            opacity: scanning ? 0.6 : 1,
          }}
        >
          {scanning ? "NAS 폴더를 읽는 중..." : "폴더 스캔 시작"}
        </button>

        {folders.length > 0 && (
          <>
            {/* Filter buttons */}
            <div style={{ display: "flex", gap: 4 }}>
              {[
                { key: "ALL" as const, label: `전체 (${total})` },
                { key: "AUTO" as const, label: `자동완료 (${autoCnt})` },
                { key: "CONFLICT" as const, label: `선택필요 (${conflictCnt})` },
                { key: "NOT_FOUND" as const, label: `불가 (${notFoundCnt})` },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    padding: "6px 12px",
                    border: "1px solid",
                    borderColor: filter === f.key ? "#006838" : "#d1d5db",
                    background: filter === f.key ? "#f0fdf4" : "#fff",
                    color: filter === f.key ? "#006838" : "#64748b",
                    borderRadius: 4,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              onClick={confirmMappings}
              disabled={confirming}
              style={{
                padding: "10px 20px",
                background: "#334155",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                cursor: "pointer",
                marginLeft: "auto",
                opacity: confirming ? 0.6 : 1,
              }}
            >
              {confirming ? "처리 중..." : "매핑 확정"}
            </button>
          </>
        )}
      </div>

      {message && (
        <div
          style={{
            padding: "8px 12px",
            background: message.includes("오류") || message.includes("실패") ? "#fef2f2" : "#f0fdf4",
            color: message.includes("오류") || message.includes("실패") ? "#dc2626" : "#16a34a",
            borderRadius: 6,
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {message}
        </div>
      )}

      {/* Results table */}
      {filtered.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ ...thStyle }}>폴더명</th>
                <th style={{ ...thStyle }}>추출 정보</th>
                <th style={{ ...thStyle, width: 140 }}>매핑 상태</th>
                <th style={{ ...thStyle, width: 200 }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.folderName} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ ...tdStyle, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.folderName}
                  </td>
                  <td style={tdStyle}>
                    {f.parsedName} / {f.parsedRegion} / {f.parsedDate}
                  </td>
                  <td style={tdStyle}>
                    {f.status === "AUTO" && <span style={{ color: "#16a34a" }}>✅ 자동매핑 완료</span>}
                    {f.status === "CONFLICT" && <span style={{ color: "#d97706" }}>⚠️ 후보 {f.candidates.length}명 선택 필요</span>}
                    {f.status === "NOT_FOUND" && <span style={{ color: "#dc2626" }}>❌ 매핑 불가</span>}
                  </td>
                  <td style={tdStyle}>
                    {f.status === "AUTO" && <span style={{ color: "#64748b", fontSize: 12 }}>확인</span>}
                    {f.status === "CONFLICT" && (
                      <select
                        value={selections[f.folderName] || ""}
                        onChange={(e) => setSelections((prev) => ({ ...prev, [f.folderName]: e.target.value }))}
                        style={{ fontSize: 12, padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: 4 }}
                      >
                        <option value="">선택...</option>
                        {f.candidates.map((c) => (
                          <option key={c.caseId} value={c.caseId}>
                            {c.patientName} ({c.caseType}) - {c.branch}
                          </option>
                        ))}
                      </select>
                    )}
                    {f.status === "NOT_FOUND" && <span style={{ color: "#94a3b8", fontSize: 12 }}>-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!scanning && folders.length === 0 && (
        <div style={{ textAlign: "center", padding: 48, color: "#94a3b8", fontSize: 14 }}>
          [폴더 스캔 시작] 버튼을 눌러 NAS 폴더를 읽어오세요.
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// 매핑 현황 탭
// ──────────────────────────────────────────────
function MappingStatusTab() {
  const [files, setFiles] = useState<MappedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [nasUrl, setNasUrl] = useState("");

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const [filesRes, cfgRes] = await Promise.all([
        fetch("/api/nas/mapping"),
        fetch("/api/system-config?keys=NAS_URL"),
      ]);
      const filesData = await filesRes.json();
      const cfgData = await cfgRes.json();

      setFiles(filesData.files || []);
      const url = (cfgData.configs || []).find((c: { key: string }) => c.key === "NAS_URL")?.value || "";
      setNasUrl(url);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const removeMapping = async (id: string) => {
    if (!confirm("매핑을 해제하시겠습니까?")) return;
    try {
      await fetch(`/api/nas/mapping/${id}`, { method: "DELETE" });
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch {
      alert("해제 실패");
    }
  };

  const openNas = (nasPath: string) => {
    if (!nasUrl) {
      alert("NAS URL이 설정되지 않았습니다.");
      return;
    }
    // Open Synology File Station with the path
    const url = `${nasUrl}/?launchApp=SYNO.SDS.App.FileStation3.Instance&launchParam=openfile=${encodeURIComponent(nasPath)}`;
    window.open(url, "_blank");
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>불러오는 중...</div>;
  }

  if (files.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 48, color: "#94a3b8", fontSize: 14 }}>
        매핑된 파일이 없습니다. [폴더 스캔] 탭에서 매핑을 시작하세요.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <th style={thStyle}>재해자명</th>
            <th style={thStyle}>상병</th>
            <th style={thStyle}>NAS 경로</th>
            <th style={{ ...thStyle, width: 140 }}>액션</th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <tr key={f.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={tdStyle}>{f.patient.name}</td>
              <td style={tdStyle}>{f.caseType}</td>
              <td style={{ ...tdStyle, maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.nasPath}
              </td>
              <td style={tdStyle}>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => openNas(f.nasPath || "")}
                    style={{
                      padding: "4px 10px",
                      background: "#006838",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    열기
                  </button>
                  <button
                    onClick={() => removeMapping(f.id)}
                    style={{
                      padding: "4px 10px",
                      background: "#dc2626",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    해제
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Shared styles ───
const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontWeight: 600,
  color: "#475569",
  fontSize: 12,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  color: "#334155",
};

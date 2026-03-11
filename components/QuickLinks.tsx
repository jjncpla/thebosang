"use client";

import { useState } from "react";

type LinkItem = { label: string; url: string };
type LinkGroup = { label: string; links: LinkItem[] };

const LINK_GROUPS: LinkGroup[] = [
  {
    label: "정부·공단",
    links: [
      { label: "고용노동부", url: "https://moel.go.kr" },
      { label: "근로복지공단", url: "https://www.comwel.or.kr" },
      { label: "공단 토탈서비스", url: "https://total.comwel.or.kr" },
    ],
  },
  {
    label: "더보상",
    links: [
      { label: "노무법인 더보상", url: "https://thebosang.kr" },
      { label: "법무법인 더보상", url: "https://thebosang.kr" },
      { label: "그룹웨어", url: "https://gw.thebosang.kr/#/" },
    ],
  },
  {
    label: "법령정보",
    links: [
      { label: "국가법령정보센터", url: "https://law.go.kr" },
      { label: "산재보상보험법", url: "https://law.go.kr" },
      { label: "근로기준법", url: "https://law.go.kr" },
    ],
  },
];

export default function QuickLinks() {
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 100,
        display: "flex",
        alignItems: "stretch",
      }}
    >
      {/* Panel */}
      {open && (
        <div
          style={{
            width: 185,
            background: "white",
            border: "1px solid #e5e7eb",
            borderRight: "none",
            borderRadius: "10px 0 0 10px",
            boxShadow: "-4px 0 20px rgba(0,0,0,0.1)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid #f1f5f9",
              background: "#f8fafc",
            }}
          >
            <span
              style={{ fontSize: 11, fontWeight: 700, color: "#374151", letterSpacing: 1 }}
            >
              빠른 링크
            </span>
          </div>
          {LINK_GROUPS.map((group) => (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                style={{
                  width: "100%",
                  background: "none",
                  border: "none",
                  borderBottom: "1px solid #f1f5f9",
                  padding: "8px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#374151",
                  textAlign: "left",
                }}
              >
                {group.label}
                <span style={{ fontSize: 10, color: "#9ca3af" }}>
                  {openGroups.has(group.label) ? "▲" : "▼"}
                </span>
              </button>
              {openGroups.has(group.label) && (
                <div style={{ background: "#f9fafb" }}>
                  {group.links.map((link) => (
                    <a
                      key={link.label}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "block",
                        padding: "6px 12px 6px 20px",
                        fontSize: 11,
                        color: "#2563eb",
                        textDecoration: "none",
                        borderBottom: "1px solid #f1f5f9",
                      }}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 24,
          background: "#2563eb",
          border: "none",
          borderRadius: open ? "0" : "6px 0 0 6px",
          color: "white",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          padding: "16px 0",
          writingMode: "vertical-rl",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 2,
        }}
      >
        LINK
      </button>
    </div>
  );
}

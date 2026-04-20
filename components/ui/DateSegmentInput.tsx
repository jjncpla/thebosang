"use client";
import React, { useRef, useEffect, useState } from "react";

type Props = {
  value: string;
  onChange: (v: string | null) => void;
  includeTime?: boolean;
  style?: React.CSSProperties;
};

function parse(v: string, includeTime: boolean) {
  if (!v) return { year: "", month: "", day: "", hour: "", minute: "" };
  const tIdx = v.indexOf("T");
  const datePart = tIdx >= 0 ? v.slice(0, tIdx) : v;
  const timePart = tIdx >= 0 ? v.slice(tIdx + 1) : "";
  const [year = "", month = "", day = ""] = datePart.split("-");
  const [hour = "", minute = ""] = timePart.split(":");
  return {
    year: year.slice(0, 4),
    month: month.slice(0, 2),
    day: day.slice(0, 2),
    hour: includeTime ? hour.slice(0, 2) : "",
    minute: includeTime ? minute.slice(0, 2) : "",
  };
}

export default function DateSegmentInput({ value, onChange, includeTime = false, style }: Props) {
  const p = parse(value, includeTime);
  const [year, setYear] = useState(p.year);
  const [month, setMonth] = useState(p.month);
  const [day, setDay] = useState(p.day);
  const [hour, setHour] = useState(p.hour);
  const [minute, setMinute] = useState(p.minute);

  const monthRef = useRef<HTMLInputElement>(null);
  const dayRef = useRef<HTMLInputElement>(null);
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);

  // Sync segments when external value changes (e.g., loaded from DB)
  const prevValue = useRef(value);
  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      const q = parse(value, includeTime);
      setYear(q.year); setMonth(q.month); setDay(q.day);
      setHour(q.hour); setMinute(q.minute);
    }
  }, [value, includeTime]);

  const emit = (y: string, mo: string, d: string, h: string, mi: string) => {
    if (!y && !mo && !d) { onChange(null); return; }
    if (y.length === 4 && mo.length >= 1 && d.length >= 1) {
      const date = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
      if (includeTime) {
        if (h.length >= 1 && mi.length >= 1) {
          onChange(`${date}T${h.padStart(2, "0")}:${mi.padStart(2, "0")}:00`);
        }
      } else {
        onChange(`${date}T00:00:00.000Z`);
      }
    }
  };

  const only = (v: string) => v.replace(/\D/g, "");

  const seg: React.CSSProperties = {
    border: "none", outline: "none", background: "transparent",
    fontSize: 13, fontFamily: "inherit", color: "#374151",
    textAlign: "center", padding: 0, appearance: "none",
    MozAppearance: "textfield" as React.CSSProperties["MozAppearance"],
  };
  const sep: React.CSSProperties = { color: "#d1d5db", fontSize: 12, userSelect: "none" };

  return (
    <div style={{ ...style, display: "flex", alignItems: "center", gap: 1 }}>
      <input
        value={year} placeholder="연도" maxLength={4} type="text" inputMode="numeric"
        style={{ ...seg, width: 38 }}
        onChange={(e) => {
          const v = only(e.target.value).slice(0, 4);
          setYear(v);
          if (v.length === 4) monthRef.current?.focus();
          emit(v, month, day, hour, minute);
        }}
      />
      <span style={sep}>-</span>
      <input
        ref={monthRef} value={month} placeholder="월" maxLength={2} type="text" inputMode="numeric"
        style={{ ...seg, width: 22 }}
        onChange={(e) => {
          const v = only(e.target.value).slice(0, 2);
          setMonth(v);
          if (v.length === 2) dayRef.current?.focus();
          emit(year, v, day, hour, minute);
        }}
      />
      <span style={sep}>-</span>
      <input
        ref={dayRef} value={day} placeholder="일" maxLength={2} type="text" inputMode="numeric"
        style={{ ...seg, width: 22 }}
        onChange={(e) => {
          const v = only(e.target.value).slice(0, 2);
          setDay(v);
          if (v.length === 2 && includeTime) hourRef.current?.focus();
          emit(year, month, v, hour, minute);
        }}
      />
      {includeTime && (
        <>
          <span style={{ ...sep, margin: "0 3px" }}>·</span>
          <input
            ref={hourRef} value={hour} placeholder="시" maxLength={2} type="text" inputMode="numeric"
            style={{ ...seg, width: 22 }}
            onChange={(e) => {
              const v = only(e.target.value).slice(0, 2);
              setHour(v);
              if (v.length === 2) minuteRef.current?.focus();
              emit(year, month, day, v, minute);
            }}
          />
          <span style={sep}>:</span>
          <input
            ref={minuteRef} value={minute} placeholder="분" maxLength={2} type="text" inputMode="numeric"
            style={{ ...seg, width: 22 }}
            onChange={(e) => {
              const v = only(e.target.value).slice(0, 2);
              setMinute(v);
              emit(year, month, day, hour, v);
            }}
          />
        </>
      )}
    </div>
  );
}

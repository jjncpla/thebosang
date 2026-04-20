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

function clamp(val: string, min: number, max: number): string {
  const n = parseInt(val, 10);
  if (isNaN(n) || val === "") return val;
  return Math.max(min, Math.min(max, n)).toString().padStart(2, "0");
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
          onChange(`${date}T${h.padStart(2, "0")}:${mi.padStart(2, "0")}:00.000Z`);
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
  const unit: React.CSSProperties = { color: "#6b7280", fontSize: 12, userSelect: "none" as React.CSSProperties["userSelect"] };
  const sep: React.CSSProperties = { color: "#d1d5db", fontSize: 12, userSelect: "none" as React.CSSProperties["userSelect"], margin: "0 1px" };

  return (
    <div className="date-seg" style={{ ...style, display: "flex", alignItems: "center", gap: 1 }}>
      <input
        value={year} placeholder="" maxLength={4} type="text" inputMode="numeric"
        style={{ ...seg, width: 38 }}
        onChange={(e) => {
          const v = only(e.target.value).slice(0, 4);
          setYear(v);
          emit(v, month, day, hour, minute);
        }}
      />
      <span style={unit}>년</span>
      <span style={sep}>-</span>
      <input
        ref={monthRef} value={month} placeholder="" maxLength={2} type="text" inputMode="numeric"
        style={{ ...seg, width: 20 }}
        onChange={(e) => {
          const v = only(e.target.value).slice(0, 2);
          setMonth(v);
          emit(year, v, day, hour, minute);
        }}
        onBlur={(e) => {
          if (!e.target.value) return;
          const clamped = clamp(e.target.value, 1, 12);
          setMonth(clamped);
          emit(year, clamped, day, hour, minute);
        }}
      />
      <span style={unit}>월</span>
      <span style={sep}>-</span>
      <input
        ref={dayRef} value={day} placeholder="" maxLength={2} type="text" inputMode="numeric"
        style={{ ...seg, width: 20 }}
        onChange={(e) => {
          const v = only(e.target.value).slice(0, 2);
          setDay(v);
          emit(year, month, v, hour, minute);
        }}
        onBlur={(e) => {
          if (!e.target.value) return;
          const clamped = clamp(e.target.value, 1, 31);
          setDay(clamped);
          emit(year, month, clamped, hour, minute);
        }}
      />
      <span style={unit}>일</span>
      {includeTime && (
        <>
          <span style={{ ...sep, margin: "0 4px" }}>·</span>
          <input
            ref={hourRef} value={hour} placeholder="" maxLength={2} type="text" inputMode="numeric"
            style={{ ...seg, width: 20 }}
            onChange={(e) => {
              const v = only(e.target.value).slice(0, 2);
              setHour(v);
              emit(year, month, day, v, minute);
            }}
            onBlur={(e) => {
              if (!e.target.value) return;
              const clamped = clamp(e.target.value, 0, 23);
              setHour(clamped);
              emit(year, month, day, clamped, minute);
            }}
          />
          <span style={unit}>시</span>
          <span style={sep}>:</span>
          <input
            ref={minuteRef} value={minute} placeholder="" maxLength={2} type="text" inputMode="numeric"
            style={{ ...seg, width: 20 }}
            onChange={(e) => {
              const v = only(e.target.value).slice(0, 2);
              setMinute(v);
              emit(year, month, day, hour, v);
            }}
            onBlur={(e) => {
              if (!e.target.value) return;
              const clamped = clamp(e.target.value, 0, 59);
              setMinute(clamped);
              emit(year, month, day, hour, clamped);
            }}
          />
          <span style={unit}>분</span>
        </>
      )}
    </div>
  );
}

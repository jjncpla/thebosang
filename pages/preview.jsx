/**
 * preview.jsx — 산재 서식 Debug Preview & Coordinate Calibration Page
 *
 * ─── FEATURES ─────────────────────────────────────────────────────────────────
 *   1.  Live form preview with zoom slider
 *   2.  Click-to-capture: click form → logs px + % coordinates
 *   3.  Field selector: click a field name → highlight it with amber outline
 *   4.  Arrow key nudge: select a field → use ↑↓←→ to move it 1px at a time
 *       • Hold Shift for 10px jumps
 *       • nudge state shown as a diff overlay (e.g. "x+3 y-2")
 *   5.  Grid overlay (20px) + ruler ticks (every 100px)
 *   6.  Coord log: last 20 clicked positions, one-click copy as pos() call
 *   7.  Live field editor: edit all values and see changes instantly
 *   8.  PDF download → POST /api/generate-pdf
 *
 * ─── NUDGE WORKFLOW ───────────────────────────────────────────────────────────
 *   1. Enable debug mode
 *   2. Click a field name in the field list → amber outline appears on form
 *   3. Use arrow keys to nudge position
 *   4. The nudge delta (e.g. x+5 y-2) is shown in the coord panel
 *   5. Copy the output pos() call and paste into fieldConfig.js
 *   6. The pos() output includes your nudge applied to the original _px values
 */

'use client';

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import FormRenderer from '@/components/FormRenderer';
import { FIELD_MAP } from '@/forms/sanjae/fieldMeta';
import { transformSanJae } from '@/forms/sanjae/transformSanJae';
import { PAGE_A4 } from '@/forms/sanjae/pageConfig';


const PAGE = PAGE_A4;

// ─────────────────────────────────────────────────────────────────────────────
// FIELD GROUPS — derived from FIELD_MAP for the editor panel
// ─────────────────────────────────────────────────────────────────────────────
const groupedFields = {
  checkbox: Object.entries(FIELD_MAP).filter(([, f]) => f.type === 'checkbox'),
  split:    Object.entries(FIELD_MAP).filter(([, f]) => f.type === 'split'),
  text:     Object.entries(FIELD_MAP).filter(([, f]) => f.type === 'text'),
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function PreviewPage() {
  const [data,          setData]          = useState({});
  const [debug,         setDebug]         = useState(true);
  const [scale,         setScale]         = useState(0.75);
  const [loading,       setLoading]       = useState(false);
  const [selectedField, setSelectedField] = useState(null);   // field key
  const [nudgeMap,      setNudgeMap]      = useState({});     // { [key]: {dx, dy} }
  const [coordLog,      setCoordLog]      = useState([]);
  const [copiedIdx,     setCopiedIdx]     = useState(null);
  const [activeTab,     setActiveTab]     = useState('fields');// 'fields' | 'log'
  const containerRef = useRef(null);

  // ── Data update ──────────────────────────────────────────────────────────
  const update = useCallback((field, value) => {
    setData(prev => ({ ...prev, [field]: value }));
  }, []);

  // ── Coord capture (click on form) ────────────────────────────────────────
  const handleCoordCapture = useCallback((coord) => {
    setCoordLog(prev => [coord, ...prev].slice(0, 20));
  }, []);

  // ── Arrow key nudging ────────────────────────────────────────────────────
  useEffect(() => {
    if (!debug || !selectedField) return;

    const onKeyDown = (e) => {
      const DIRS = { ArrowLeft: [-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1] };
      const dir = DIRS[e.key];
      if (!dir) return;

      // Prevent page scroll
      e.preventDefault();

      const step = e.shiftKey ? 10 : 1;
      const [dx, dy] = dir.map(v => v * step);

      setNudgeMap(prev => {
        const current = prev[selectedField] || { dx: 0, dy: 0 };
        return {
          ...prev,
          [selectedField]: {
            dx: current.dx + dx,
            dy: current.dy + dy,
          },
        };
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [debug, selectedField]);

  // ── Compute nudged FIELD_MAP for rendering ───────────────────────────────
  // We apply nudge deltas directly to the _px values and re-compute %.
  const nudgedFieldMap = useMemo(() => {
    const map = { ...FIELD_MAP };
    for (const [key, { dx, dy }] of Object.entries(nudgeMap)) {
      if (!dx && !dy) continue;
      const field = map[key];
      if (!field) continue;

      if (field.type === 'split') {
        map[key] = {
          ...field,
          positions: field.positions.map(p => ({
            ...p,
            _px: { ...p._px, x: p._px.x + dx, y: p._px.y + dy },
            top:  `${(((p._px.y + dy) / PAGE.h) * 100).toFixed(4)}%`,
            left: `${(((p._px.x + dx) / PAGE.w) * 100).toFixed(4)}%`,
          })),
        };
      } else {
        const { x, y, w, h } = field._px;
        const nx = x + dx;
        const ny = y + dy;
        map[key] = {
          ...field,
          _px:   { x: nx, y: ny, w, h },
          top:   `${((ny / PAGE.h) * 100).toFixed(4)}%`,
          left:  `${((nx / PAGE.w) * 100).toFixed(4)}%`,
        };
      }
    }
    return map;
  }, [nudgeMap]);

  // ── pos() output for selected + nudged field ─────────────────────────────
  const nudgedPosOutput = useMemo(() => {
    if (!selectedField) return null;
    const nudge = nudgeMap[selectedField];
    const field = nudgedFieldMap[selectedField];
    if (!field) return null;

    if (field.type === 'split') {
      const first = field.positions[0];
      const { x, y, w, h } = first._px;
      const n = nudge || { dx: 0, dy: 0 };
      return `splitRow(${y}, ${x}, ${w}, ${h}, ${field.positions.length}, gap)`;
    }

    const { x, y, w, h } = field._px;
    return `pos(${x}, ${y}, ${w}, ${h})`;
  }, [selectedField, nudgeMap, nudgedFieldMap]);

  // ── Reset nudge for selected field ───────────────────────────────────────
  const resetNudge = useCallback(() => {
    if (!selectedField) return;
    setNudgeMap(prev => {
      const next = { ...prev };
      delete next[selectedField];
      return next;
    });
  }, [selectedField]);

  // ── PDF download ─────────────────────────────────────────────────────────
  const downloadPDF = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/generate-pdf', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ data, debug: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href: url, download: 'sanjae_form.pdf' }).click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`PDF 생성 실패: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Copy coord to clipboard ───────────────────────────────────────────────
  const copyCoord = (coord, idx) => {
    navigator.clipboard.writeText(`pos(${coord.x}, ${coord.y}, ?, ?)`).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  };

  const currentNudge = selectedField ? (nudgeMap[selectedField] || { dx: 0, dy: 0 }) : null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={s.root}>

      {/* ── TOOLBAR ── */}
      <header style={s.toolbar}>
        <span style={s.logo}>산재 서식 미리보기</span>

        <Toggle label="Debug" active={debug} color="#dc2626" onClick={() => setDebug(v => !v)} />

        <label style={s.zoomLabel}>
          Zoom
          <input
            type="range" min={0.3} max={1.2} step={0.05}
            value={scale}
            onChange={e => setScale(Number(e.target.value))}
            style={s.zoomSlider}
          />
          <span style={s.zoomVal}>{Math.round(scale * 100)}%</span>
        </label>

        <button
          style={{ ...s.btn, ...(loading ? s.btnOff : {}) }}
          disabled={loading}
          onClick={downloadPDF}
        >
          {loading ? '생성 중…' : '⬇ PDF'}
        </button>
      </header>

      {/* ── BODY ── */}
      <div style={s.body}>

        {/* ── LEFT: form preview ── */}
        <div style={s.previewCol}>
          {/* Hint bar */}
          {debug && (
            <div style={s.hintBar}>
              {selectedField
                ? <>
                    <span style={{ color: '#f59e0b', fontWeight: 700 }}>{selectedField}</span>
                    &nbsp;선택됨 · ↑↓←→ 1px 이동 · Shift+화살표 10px
                    {currentNudge && (currentNudge.dx !== 0 || currentNudge.dy !== 0) && (
                      <span style={s.nudgeBadge}>
                        {currentNudge.dx !== 0 ? ` x${currentNudge.dx > 0 ? '+' : ''}${currentNudge.dx}` : ''}
                        {currentNudge.dy !== 0 ? ` y${currentNudge.dy > 0 ? '+' : ''}${currentNudge.dy}` : ''}
                      </span>
                    )}
                    <button style={s.resetBtn} onClick={resetNudge}>리셋</button>
                  </>
                : '🖱 클릭으로 좌표 캡처 · 필드 선택 후 화살표 키로 미세 조정'
              }
            </div>
          )}

          {/* The form — wrapped in a scaled container */}
          <div
            ref={containerRef}
            style={{
              width:        PAGE.w * scale,
              height:       PAGE.h * scale,
              flexShrink:   0,
              boxShadow:    '0 4px 28px rgba(0,0,0,.18)',
              borderRadius: 2,
              overflow:     'hidden',
            }}
          >
            <div style={{ transformOrigin: 'top left', transform: `scale(${scale})` }}>
              {/*
                We pass nudgedFieldMap via a custom prop.
                SanJaeForm wraps FormRenderer — for nudge to work we need to
                pass the overridden fieldMap. We use a lightweight inline
                FormRenderer call here to support that, bypassing SanJaeForm's
                internal FIELD_MAP reference.
              */}
              <NudgedFormRenderer
                data={data}
                debug={debug}
                fieldMap={nudgedFieldMap}
                selectedField={selectedField}
                onCoordCapture={handleCoordCapture}
                onSelectField={setSelectedField}
              
              />
            </div>
          </div>
        </div>

        {/* ── RIGHT: control panel ── */}
        <aside style={s.panel}>

          {/* Tabs */}
          <div style={s.tabs}>
            <TabBtn active={activeTab === 'fields'} onClick={() => setActiveTab('fields')}>
              ✏️ 필드
            </TabBtn>
            <TabBtn active={activeTab === 'log'} onClick={() => setActiveTab('log')}>
              📍 좌표 로그
            </TabBtn>
          </div>

          <div style={s.panelBody}>

            {activeTab === 'log' && (
              <CoordLogPanel
                log={coordLog}
                copiedIdx={copiedIdx}
                onCopy={copyCoord}
              />
            )}

            {activeTab === 'fields' && (
              <>
                {/* Nudge output */}
                {debug && selectedField && nudgedPosOutput && (
                  <div style={s.nudgeOutput}>
  <div style={s.nudgeOutputLabel}>📦 전체 fieldConfig 복사</div>

  <button
    style={s.copyBtn}
    onClick={() => {
      const cleanFields = Object.entries(nudgedFieldMap).map(([key, field]) => {
        if (field.type === 'split') {
          return {
            name: key,
            type: 'split',
            positions: field.positions.map(p => ({
              x: Math.round(p._px.x),
              y: Math.round(p._px.y),
              w: Math.round(p._px.w),
              h: Math.round(p._px.h),
            })),
          };
        }

        return {
          name: key,
          type: field.type,
          x: Math.round(field._px.x),
          y: Math.round(field._px.y),
          w: Math.round(field._px.w),
          h: Math.round(field._px.h),
        };
      });

      const json = JSON.stringify(cleanFields, null, 2);

      console.log(json);
      navigator.clipboard.writeText(json);
      alert('전체 좌표 복사 완료');
    }}
  >
    전체 복사
  </button>
</div>
                )}

                <FieldEditor
                  data={data}
                  update={update}
                  selectedField={selectedField}
                  onSelectField={debug ? setSelectedField : null}
                  nudgeMap={nudgeMap}
                />
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NUDGED FORM RENDERER
// Passes a custom fieldMap to FormRenderer, bypassing SanJaeForm's static import.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo as _useMemo } from 'react';


function NudgedFormRenderer({ data, debug, fieldMap, selectedField, onCoordCapture, onSelectField }) {
  const payload = _useMemo(() => transformSanJae(data), [data]);

  return (
    <FormRenderer
      id="sanjae-form-page"
      fieldMap={fieldMap}
      payload={payload}
      page={PAGE_A4}
      debug={debug}
      selectedField={selectedField}
      onCoordCapture={onCoordCapture}
      onSelectField={onSelectField}
      
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COORD LOG PANEL
// ─────────────────────────────────────────────────────────────────────────────
function CoordLogPanel({ log, copiedIdx, onCopy }) {
  return (
    <div>
      {log.length === 0 ? (
        <div style={s.emptyState}>폼을 클릭해 좌표를 캡처하세요</div>
      ) : (
        log.map((c, i) => (
          <div key={i} style={s.coordRow}>
            <div style={s.coordMain}>
              <code style={s.coordCode}>px: ({c.x}, {c.y})</code>
              <span style={s.coordPct}>{c.xPct}%, {c.yPct}%</span>
            </div>
            <button
              style={{ ...s.copyBtn, ...(copiedIdx === i ? s.copyBtnDone : {}) }}
              onClick={() => onCopy(c, i)}
            >
              {copiedIdx === i ? '✓' : '복사'}
            </button>
          </div>
        ))
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FIELD EDITOR
// ─────────────────────────────────────────────────────────────────────────────
function FieldEditor({ data, update, selectedField, onSelectField, nudgeMap }) {
  return (
    <div>
      {/* Checkboxes */}
      <SectionLabel>체크박스</SectionLabel>
      {groupedFields.checkbox.map(([key, meta]) => (
        <FieldRow
          key={key}
          fieldKey={key}
          label={meta.label}
          selected={selectedField === key}
          nudged={!!nudgeMap[key]}
          onSelect={onSelectField}
        >
          <input
            type="checkbox"
            checked={!!data[key]}
            onChange={e => update(key, e.target.checked)}
            style={{ margin: 0 }}
          />
        </FieldRow>
      ))}

      <FieldRow key="_accountType" fieldKey="_accountType" label="계좌유형" onSelect={null}>
        <select
          value={data.accountType || 'regular'}
          onChange={e => update('accountType', e.target.value)}
          style={s.select}
        >
          <option value="regular">보통예금</option>
          <option value="saving">저축예금</option>
        </select>
      </FieldRow>

      {/* Split fields */}
      <SectionLabel>날짜 필드 (YYYYMMDD)</SectionLabel>
      {groupedFields.split.map(([key, meta]) => (
        <FieldRow
          key={key}
          fieldKey={key}
          label={meta.label}
          selected={selectedField === key}
          nudged={!!nudgeMap[key]}
          onSelect={onSelectField}
        >
          <input
            value={data[key] ?? ''}
            maxLength={8}
            onChange={e => update(key, e.target.value.replace(/\D/g, ''))}
            placeholder="YYYYMMDD"
            style={{ ...s.input, fontFamily: 'monospace', letterSpacing: '2px', width: 100 }}
          />
          <span style={s.hint}>{meta.hint}</span>
        </FieldRow>
      ))}

      {/* Text fields */}
      <SectionLabel>텍스트</SectionLabel>
      {groupedFields.text.map(([key, meta]) => (
        <FieldRow
          key={key}
          fieldKey={key}
          label={meta.label}
          selected={selectedField === key}
          nudged={!!nudgeMap[key]}
          onSelect={onSelectField}
        >
          <input
            value={data[key] ?? ''}
            onChange={e => update(key, e.target.value)}
            style={s.input}
          />
        </FieldRow>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function FieldRow({ fieldKey, label, selected, nudged, onSelect, children }) {
  const isSelectable = !!onSelect;
  return (
    <div
      style={{
        ...s.fieldRow,
        background: selected ? 'rgba(245,158,11,0.08)' : 'transparent',
        borderLeft:  selected ? '3px solid #f59e0b' : '3px solid transparent',
      }}
    >
      <div
        style={{
          ...s.fieldLabel,
          cursor:    isSelectable ? 'pointer' : 'default',
          color:     selected ? '#92400e' : nudged ? '#1d4ed8' : '#374151',
          fontWeight: selected || nudged ? 600 : 400,
        }}
        onClick={() => isSelectable && onSelect(selected ? null : fieldKey)}
        title={isSelectable ? 'クリックして選択' : undefined}
      >
        {nudged && <span style={s.nudgeDot} title="좌표 조정됨">●</span>}
        {label}
      </div>
      <div style={s.fieldControl}>{children}</div>
    </div>
  );
}

const SectionLabel = ({ children }) => (
  <div style={s.sectionLabel}>{children}</div>
);

const Toggle = ({ label, active, color, onClick }) => (
  <button
    onClick={onClick}
    style={{
      ...s.toggle,
      background:  active ? color : '#e5e7eb',
      color:       active ? '#fff' : '#4b5563',
      borderColor: active ? color : '#d1d5db',
    }}
  >
    {label}
  </button>
);

const TabBtn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      ...s.tab,
      borderBottom: active ? '2px solid #1d4ed8' : '2px solid transparent',
      color:        active ? '#1d4ed8' : '#6b7280',
      fontWeight:   active ? 700 : 400,
    }}
  >
    {children}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = {
  root: {
    display:       'flex',
    flexDirection: 'column',
    height:        '100vh',
    overflow:      'hidden',
    background:    '#f3f4f6',
    fontFamily:    "'Inter', 'Pretendard', 'Noto Sans KR', sans-serif",
    fontSize:      13,
  },
  toolbar: {
    display:     'flex',
    gap:         12,
    alignItems:  'center',
    padding:     '9px 20px',
    background:  '#fff',
    borderBottom:'1px solid #e5e7eb',
    boxShadow:   '0 1px 3px rgba(0,0,0,.06)',
    flexShrink:  0,
    zIndex:      50,
  },
  logo: { fontWeight: 800, fontSize: 14, marginRight: 4 },
  zoomLabel: { display:'flex', alignItems:'center', gap:4, color:'#4b5563' },
  zoomSlider:{ width: 90 },
  zoomVal:   { width: 38, fontSize: 12, color: '#9ca3af', textAlign:'right' },
  btn: {
    marginLeft:   'auto',
    padding:      '6px 16px',
    background:   '#1d4ed8',
    color:        '#fff',
    border:       'none',
    borderRadius: 6,
    cursor:       'pointer',
    fontWeight:   700,
    fontSize:     12,
  },
  btnOff: { background: '#9ca3af', cursor: 'wait' },
  body: {
    display:    'flex',
    flex:       1,
    overflow:   'hidden',
    gap:        0,
  },
  previewCol: {
    display:       'flex',
    flexDirection: 'column',
    padding:       '16px 16px 16px 20px',
    overflowY:     'auto',
    gap:           8,
    flexShrink:    0,
  },
  hintBar: {
    fontSize:    11,
    color:       '#6b7280',
    fontFamily:  'monospace',
    background:  '#f9fafb',
    border:      '1px solid #e5e7eb',
    borderRadius: 5,
    padding:     '4px 10px',
    display:     'flex',
    alignItems:  'center',
    gap:         6,
    minHeight:   26,
  },
  nudgeBadge: {
    background:   '#fef3c7',
    color:        '#92400e',
    borderRadius: 3,
    padding:      '1px 5px',
    fontSize:     10,
    fontWeight:   700,
    fontFamily:   'monospace',
  },
  resetBtn: {
    marginLeft:   'auto',
    background:   'none',
    border:       '1px solid #d1d5db',
    borderRadius: 4,
    fontSize:     10,
    padding:      '1px 7px',
    cursor:       'pointer',
    color:        '#6b7280',
  },
  panel: {
    width:         340,
    flexShrink:    0,
    display:       'flex',
    flexDirection: 'column',
    background:    '#fff',
    borderLeft:    '1px solid #e5e7eb',
    overflow:      'hidden',
  },
  tabs: {
    display:    'flex',
    borderBottom: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  tab: {
    flex:       1,
    padding:    '10px 0',
    border:     'none',
    background: 'none',
    cursor:     'pointer',
    fontSize:   12,
    transition: 'all 0.15s',
  },
  panelBody: {
    flex:     1,
    overflowY:'auto',
    padding:  '8px 0',
  },
  nudgeOutput: {
    margin:       '4px 10px 8px',
    padding:      '8px 10px',
    background:   '#eff6ff',
    border:       '1px solid #bfdbfe',
    borderRadius: 6,
    display:      'flex',
    flexDirection:'column',
    gap:          5,
  },
  nudgeOutputLabel: { fontSize: 10, color: '#1d4ed8', fontWeight: 700 },
  nudgeOutputCode: {
    fontFamily: 'monospace',
    fontSize:   11,
    color:      '#1e3a8a',
    wordBreak:  'break-all',
  },
  sectionLabel: {
    padding:       '8px 12px 3px',
    fontSize:      10,
    fontWeight:    700,
    color:         '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  fieldRow: {
    display:     'flex',
    alignItems:  'center',
    gap:         6,
    padding:     '3px 10px 3px 8px',
    borderRadius: 0,
    transition:  'background 0.1s',
  },
  fieldLabel: {
    width:        120,
    flexShrink:   0,
    fontSize:     11,
    overflow:     'hidden',
    textOverflow: 'ellipsis',
    whiteSpace:   'nowrap',
    display:      'flex',
    alignItems:   'center',
    gap:          4,
    transition:   'color 0.15s',
  },
  nudgeDot: {
    color:    '#3b82f6',
    fontSize: 8,
    flexShrink: 0,
  },
  fieldControl: {
    flex:       1,
    display:    'flex',
    alignItems: 'center',
    gap:        4,
    minWidth:   0,
  },
  input: {
    flex:         1,
    fontSize:     11,
    padding:      '3px 6px',
    border:       '1px solid #d1d5db',
    borderRadius: 4,
    color:        '#111',
    minWidth:     0,
    outline:      'none',
  },
  select: {
    fontSize:   11,
    padding:    '3px 5px',
    border:     '1px solid #d1d5db',
    borderRadius: 4,
  },
  hint: {
    fontSize:   9,
    color:      '#9ca3af',
    whiteSpace: 'nowrap',
  },
  toggle: {
    border:       '1px solid',
    borderRadius: 5,
    padding:      '5px 11px',
    cursor:       'pointer',
    fontSize:     12,
    fontWeight:   600,
    transition:   'all 0.15s',
  },
  emptyState: {
    padding:   '20px',
    color:     '#9ca3af',
    textAlign: 'center',
    fontSize:  12,
  },
  coordRow: {
    display:     'flex',
    alignItems:  'center',
    gap:         6,
    padding:     '3px 10px',
    borderBottom:'1px solid #f9fafb',
  },
  coordMain: {
    flex:          1,
    display:       'flex',
    flexDirection: 'column',
    gap:           1,
  },
  coordCode: {
    fontFamily: 'monospace',
    fontSize:   11,
    color:      '#111',
  },
  coordPct: {
    fontSize:   10,
    color:      '#9ca3af',
    fontFamily: 'monospace',
  },
  copyBtn: {
    fontSize:     10,
    padding:      '2px 8px',
    border:       '1px solid #d1d5db',
    borderRadius: 4,
    background:   '#fff',
    cursor:       'pointer',
    color:        '#374151',
    flexShrink:   0,
  },
  copyBtnDone: {
    background:  '#d1fae5',
    borderColor: '#6ee7b7',
    color:       '#065f46',
  },
};
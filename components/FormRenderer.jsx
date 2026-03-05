

import React, { useCallback, useMemo } from 'react';
import { PAGE_A4 } from '@/forms/sanjae/pageConfig';

const PAGE = PAGE_A4;

const FONT_FAMILY = {
  kr: "'Noto Sans KR', sans-serif",
  mono: "'Roboto Mono', monospace",
};

// ─────────────────────────────────────────────
// BASE OVERLAY
// ─────────────────────────────────────────────
const Overlay = ({
  pos,
  children,
  debugOutline,
  fieldKey,
  debug,
  onSelectField,
}) => {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (debug && onSelectField) {
          onSelectField(fieldKey);
        }
      }}
      style={{
        position: 'absolute',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        height: pos.height,
        boxSizing: 'border-box',
        overflow: 'hidden',
        outline: debugOutline,
        outlineOffset: '-1px',
        cursor: debug ? 'pointer' : 'default',
      }}
    >
      {children}
    </div>
  );
};

// ─────────────────────────────────────────────
// CENTER STYLE
// ─────────────────────────────────────────────
const CENTER = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};

// ─────────────────────────────────────────────
// TEXT
// ─────────────────────────────────────────────
const TextRenderer = React.memo(function TextRenderer({
  field,
  value,
  debug,
  fieldKey,
  onSelectField,
}) {
  const hasValue = value !== null && value !== undefined && value !== '';

  const outline = debug
    ? hasValue
      ? '1px solid rgba(220,50,50,0.8)'
      : '1px solid rgba(220,50,50,0.25)'
    : 'none';

  if (!hasValue && !debug) return null;

  return (
    <Overlay
      pos={field}
      debugOutline={outline}
      fieldKey={fieldKey}
      debug={debug}
      onSelectField={onSelectField}
    >
      {hasValue && (
        <div
          style={{
            ...CENTER,
            fontFamily: FONT_FAMILY[field.font] || FONT_FAMILY.kr,
            fontSize: '11px',
            color: '#000',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </div>
      )}
    </Overlay>
  );
});

// ─────────────────────────────────────────────
// CHECKBOX
// ─────────────────────────────────────────────
const CheckRenderer = React.memo(function CheckRenderer({
  field,
  value,
  debug,
  fieldKey,
  onSelectField,
}) {
  const outline = debug
    ? value
      ? '1px solid rgba(220,50,50,0.9)'
      : '1px solid rgba(220,50,50,0.2)'
    : 'none';

  if (!value && !debug) return null;

  return (
    <Overlay
      pos={field}
      debugOutline={outline}
      fieldKey={fieldKey}
      debug={debug}
      onSelectField={onSelectField}
    >
      {value && (
        <div style={{ ...CENTER, fontSize: '12px', fontWeight: 'bold' }}>
          ✔
        </div>
      )}
    </Overlay>
  );
});

// ─────────────────────────────────────────────
// SPLIT
// ─────────────────────────────────────────────
const SplitRenderer = React.memo(function SplitRenderer({
  field,
  value,
  debug,
  fieldKey,
  onSelectField,
}) {
  return (
    <>
      {field.positions.map((slotPos, i) => {
        const char = value?.[i] ?? '';
        const hasChar = char.trim() !== '';

        const outline = debug
          ? hasChar
            ? '1px solid rgba(0,90,255,0.85)'
            : '1px solid rgba(0,90,255,0.2)'
          : 'none';

        if (!hasChar && !debug) return null;

        return (
          <Overlay
            key={i}
            pos={slotPos}
            debugOutline={outline}
            fieldKey={fieldKey}
            debug={debug}
            onSelectField={onSelectField}
          >
            {hasChar && (
              <div
                style={{
                  ...CENTER,
                  fontFamily: FONT_FAMILY.mono,
                  fontSize: '10px',
                  fontWeight: 600,
                }}
              >
                {char}
              </div>
            )}
          </Overlay>
        );
      })}
    </>
  );
});

const rendererMap = {
  text: TextRenderer,
  checkbox: CheckRenderer,
  split: SplitRenderer,
};

const Field = React.memo(function Field({
  fieldKey,
  field,
  payload,
  debug,
  onSelectField,
}) {
  const Renderer = rendererMap[field.type];
  if (!Renderer) return null;

  const item = payload[fieldKey];
  if (!item) return null;

  return (
    <Renderer
      field={field}
      value={item.value}
      debug={debug}
      fieldKey={fieldKey}
      onSelectField={onSelectField}
    />
  );
});

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
export default function FormRenderer({
  fieldMap,
  payload,
  page = PAGE,
  backgroundImage,
  debug = false,
  selectedField = null,
  onCoordCapture = null,
  onSelectField = null,
  id = 'form-page',
}) {
  const bgSrc = backgroundImage || page.background;

  const handleClick = useCallback(
    (e) => {
      if (!debug || !onCoordCapture) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      onCoordCapture({
        x: Math.round(x),
        y: Math.round(y),
        xPct: ((x / page.w) * 100).toFixed(4),
        yPct: ((y / page.h) * 100).toFixed(4),
      });
    },
    [debug, onCoordCapture, page]
  );

  return (
    <div
      id={id}
      onClick={handleClick}
      style={{
        position: 'relative',
        width: page.w,
        height: page.h,
        backgroundColor: '#fff',
        overflow: 'hidden',
        cursor: debug ? 'crosshair' : 'default',
      }}
    >
      <img
        src={bgSrc}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />

      {Object.entries(fieldMap).map(([key, field]) => (
        <Field
          key={key}
          fieldKey={key}
          field={field}
          payload={payload}
          debug={debug}
          onSelectField={onSelectField}
        />
      ))}

    




      {debug && selectedField && fieldMap[selectedField] && (
        <div
          style={{
            position: 'absolute',
            top: fieldMap[selectedField].top,
            left: fieldMap[selectedField].left,
            width: fieldMap[selectedField].width,
            height: fieldMap[selectedField].height,
            outline: '2px solid #f59e0b',
            pointerEvents: 'none',
            boxShadow: '0 0 0 4px rgba(245,158,11,0.15)',
          }}
        />
      )}
    </div>
  );
}


export function renderFormHTML({
  fieldMap,
  payload,
  page,
  backgroundImage,
}) {

  const bgSrc = backgroundImage || page.background;

  const fieldsHTML = Object.entries(fieldMap)
    .map(([key, field]) => {
      const item = payload[key];
      if (!item) return '';

      const value = item.value;

      // TEXT
      if (field.type === 'text') {
        if (!value) return '';

        return `
          <div style="
            position:absolute;
            top:${field.top}px;
            left:${field.left}px;
            width:${field.width}px;
            height:${field.height}px;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:11px;
            font-family:${field.font === 'mono' ? "'Roboto Mono', monospace" : "'Noto Sans KR', sans-serif"};
          ">
            ${value}
          </div>
        `;
      }

      // CHECKBOX
      if (field.type === 'checkbox') {
        if (!value) return '';

        return `
          <div style="
            position:absolute;
            top:${field.top}px;
            left:${field.left}px;
            width:${field.width}px;
            height:${field.height}px;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:12px;
            font-weight:bold;
          ">
            ✔
          </div>
        `;
      }

      // SPLIT
      if (field.type === 'split') {
        if (!value) return '';

        return field.positions.map((pos, i) => {
          const char = value[i] || '';
          if (!char) return '';

          return `
            <div style="
              position:absolute;
              top:${pos.top}px;
              left:${pos.left}px;
              width:${pos.width}px;
              height:${pos.height}px;
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:10px;
              font-family:'Roboto Mono', monospace;
              font-weight:600;
            ">
              ${char}
            </div>
          `;
        }).join('');
      }

      return '';
    })
    .join('');

  return `
    <div style="
      position:relative;
      width:${page.w}px;
      height:${page.h}px;
      background-color:#fff;
    ">
      <img src="${bgSrc}" style="
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
      "/>

      ${fieldsHTML}
    </div>
  `;
}
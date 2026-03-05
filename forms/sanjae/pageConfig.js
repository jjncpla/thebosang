/**
 * pageConfig.js — Page Geometry & Global Rendering Constants
 *
 * All renderer modules import from here.
 * Replacing PAGE_W / PAGE_H globals with a typed PAGE object
 * means multiple form types (A4, A5, custom) can coexist.
 *
 * Usage:
 *   import { PAGE, pctX, pctY, pos, splitRow, FONT_FAMILY } from './pageConfig';
 */

// ─────────────────────────────────────────────────────────────────────────────
// PAGE OBJECT
// Defines the canonical rendering canvas for a given form type.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} PageConfig
 * @property {string} id          - Form identifier (used for routing/naming)
 * @property {string} label       - Human-readable name
 * @property {number} w           - Canvas width  in px (at 96 dpi)
 * @property {number} h           - Canvas height in px (at 96 dpi)
 * @property {string} printW      - CSS width  for @page rule  (e.g. '210mm')
 * @property {string} printH      - CSS height for @page rule  (e.g. '297mm')
 * @property {number} scaleFactor - Puppeteer deviceScaleFactor
 * @property {string} background  - Public path to blank form image
 */

/** A4 — standard Korean government form */
export const PAGE_A4 = /** @type {PageConfig} */ ({
  id:          'a4',
  label:       'A4 (210 × 297 mm)',
  w:           794,
  h:           1123,
  printW:      '210mm',
  printH:      '297mm',
  scaleFactor: 2,
  background: 'form-backgrounds/disability-claim-v1-page1.jpg',
});

/** A5 — example of a second supported size */
export const PAGE_A5 = /** @type {PageConfig} */ ({
  id:          'a5',
  label:       'A5 (148 × 210 mm)',
  w:           559,
  h:           794,
  printW:      '148mm',
  printH:      '210mm',
  scaleFactor: 2,
  background: 'public/form-backgrounds/disability-claim-v1-page1.jpg',
});

/** Default page used by the 산재 form */
export const PAGE = PAGE_A4;

// ─────────────────────────────────────────────────────────────────────────────
// COORDINATE HELPERS
// All helpers are PAGE-agnostic — pass the page object explicitly
// so the same helper works for A4, A5, or any custom canvas.
// ─────────────────────────────────────────────────────────────────────────────

/** px → % string, relative to page width */
export const pctX = (px, page = PAGE) =>
  `${((px / page.w) * 100).toFixed(4)}%`;

/** px → % string, relative to page height */
export const pctY = (px, page = PAGE) =>
  `${((px / page.h) * 100).toFixed(4)}%`;

/**
 * Build a single position object from px measurements.
 *
 * @param {number}     x    - left edge in px
 * @param {number}     y    - top edge in px
 * @param {number}     w    - width in px
 * @param {number}     h    - height in px
 * @param {PageConfig} page - target page (defaults to PAGE_A4)
 * @returns {{ top, left, width, height, _px }}
 */
export const pos = (x, y, w, h, page = PAGE) => ({
  top:    pctY(y, page),
  left:   pctX(x, page),
  width:  pctX(w, page),
  height: pctY(h, page),
  /** Raw px values — kept for debug display and arrow-key nudging */
  _px: { x, y, w, h },
});

/**
 * Build an array of per-character position objects (for split fields).
 * Characters flow left-to-right from startX.
 *
 * @param {number}     y       - top edge in px (shared row)
 * @param {number}     startX  - left edge of the FIRST character box
 * @param {number}     charW   - width of each character box in px
 * @param {number}     charH   - height of each character box in px
 * @param {number}     count   - number of character slots
 * @param {number}     gap     - px gap between consecutive boxes
 * @param {PageConfig} page    - target page
 * @returns {Array<{ top, left, width, height, _px }>}
 */
export const splitRow = (y, startX, charW, charH, count, gap = 0, page = PAGE) =>
  Array.from({ length: count }, (_, i) =>
    pos(startX + i * (charW + gap), y, charW, charH, page)
  );

// ─────────────────────────────────────────────────────────────────────────────
// FONT REGISTRY
// Maps font token → CSS font-family string.
// Used by fieldMeta.js and the Puppeteer HTML builder.
// ─────────────────────────────────────────────────────────────────────────────
export const FONT_FAMILY = {
  /** Korean text — names, place names, labels */
  kr:   "'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
  /** Numbers, codes, dates — fixed-width for even spacing */
  mono: "'Courier New', 'Courier', monospace",
};
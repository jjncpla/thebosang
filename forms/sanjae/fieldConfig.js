/**
 * fieldConfig.js — Coordinate Definitions Only
 *
 * ─── RESPONSIBILITY ───────────────────────────────────────────────────────────
 *   THIS FILE CONTAINS ONLY POSITIONS.
 *   No types, no fonts, no labels, no checkbox logic.
 *   Those concerns live in fieldMeta.js.
 *
 *   This file is the one you edit with Figma / GIMP measurements.
 *   Every entry maps a field key to a position object from pageConfig helpers.
 *
 * ─── HOW TO MEASURE ───────────────────────────────────────────────────────────
 *   1. Open public/forms/sanjae_blank.png in Figma at 794×1123
 *   2. Draw a rectangle over each field box
 *   3. Read X, Y (top-left corner) and W, H from Inspect panel
 *   4. Replace pos(x, y, w, h) values below
 *   5. For split fields: measure the FIRST box only, tune charW+gap to fit
 *
 * ─── COORDINATE SYSTEM ────────────────────────────────────────────────────────
 *   Origin: top-left of the blank form image
 *   Units:  px  (at 794 × 1123 canvas = A4 @ 96 dpi)
 *   pos() converts px → % automatically.
 *
 * ⚠️  All values below are PLACEHOLDER coordinates.
 *     Use debug=true in preview to verify alignment visually.
 */

import { pos, splitRow, PAGE } from './pageConfig';

// ─────────────────────────────────────────────────────────────────────────────
// COORD MAP
// Pure coordinate data — no type annotations, no rendering hints.
// Keys must exactly match the keys used in fieldMeta.js.
// ─────────────────────────────────────────────────────────────────────────────
export const COORD_MAP = {

  // ── CHECKBOXES ──
  disabilityClaim:       pos(260, 124, 16, 16),
  preventionClaim:       pos(260, 148, 16, 16),
  accountChange:         pos(374, 289, 16, 16),
  accountType_regular:   pos(153, 365, 16, 16),
  accountType_saving:    pos(289, 365, 16, 16),
  preExistingDisability: pos(636, 398, 16, 16),
  compensationReceived:  pos(620, 434, 16, 16),

  // ── TEXT ──
  victimName:         pos(150, 220, 140, 18),
  bankName:           pos(230, 314, 100, 18),
  accountNumber:      pos(220, 340, 200, 18),
  compensationDate:   pos(110, 495, 140, 18),
  compensationAmount: pos(220, 495, 120, 18),
  compensationPayer:  pos(320, 495, 140, 18),
  transportCost:      pos(182, 529, 100, 18),
  diseaseName:        pos(128, 587, 200, 18),
  hospitalName:       pos(510, 590, 200, 18),
  claimantName:       pos(370, 679, 140, 18),
  agentName:          pos(370, 698, 140, 18),
  claimantPhone:      pos(569, 680, 160, 18),
  agentPhone:         pos(569, 696, 160, 18),
  officeName:         pos(292, 990, 200, 18),
  accidentDate_0: pos(132, 261, 12, 18),
  accidentDate_1: pos(153, 261, 12, 18),
  accidentDate_2: pos(175, 261, 12, 18),
  accidentDate_3: pos(199, 261, 12, 18),
  accidentDate_4: pos(241, 261, 12, 18),
  accidentDate_5: pos(263, 261, 12, 18),
  accidentDate_6: pos(305, 261, 12, 18),
  accidentDate_7: pos(327, 261, 12, 18),

  birthDate_0: pos(376, 219, 12, 18),
  birthDate_1: pos(399, 219, 12, 18),
  birthDate_2: pos(422, 219, 12, 18),
  birthDate_3: pos(445, 219, 12, 18),
  birthDate_4: pos(486, 219, 12, 18),
  birthDate_5: pos(509, 219, 12, 18),
  birthDate_6: pos(550, 219, 12, 18),
  birthDate_7: pos(573, 219, 12, 18),

  claimYear:  pos(523, 662, 40, 18),  // 4자리
  claimMonth: pos(580, 662, 20, 18),  // 2자리
  claimDay:   pos(624, 662, 20, 18),  // 2자리
};
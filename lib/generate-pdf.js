/**
 * generate-pdf.js — Puppeteer PDF Generation API
 *
 * POST /api/generate-pdf
 * Body: { data: FormData, debug?: boolean }
 * Returns: application/pdf
 *
 * ─── RENDERING STRATEGY ──────────────────────────────────────────────────────
 *
 *   preview page                   generate-pdf.js
 *   ───────────────                ──────────────────────────────────
 *   transformSanJae(data)          transformSanJae(data)
 *     → payload                      → payload
 *       → <FormRenderer />              → renderToString(<FormRenderer />)
 *         → DOM                           → HTML string → Puppeteer → PDF
 *
 *   Both paths use the IDENTICAL component tree.
 *   "Preview = PDF" is structurally guaranteed — not by convention.
 *
 * ─── BACKGROUND IMAGE ─────────────────────────────────────────────────────────
 *   Puppeteer receives an HTML string via page.setContent().
 *   Relative paths (e.g. /forms/…) are not resolved in that context.
 *   We construct an absolute file:// URL from process.cwd() so the image
 *   loads without requiring a running HTTP server.
 *
 * ─── ROUTES ───────────────────────────────────────────────────────────────────
 *   App Router  (Next 13+): exported POST function
 *   Pages Router           : handler export below (uncomment to use)
 *
 * ─── SETUP ────────────────────────────────────────────────────────────────────
 *   npm install puppeteer react react-dom
 *   Place blank form at: public/forms/sanjae_blank.png
 */

import path                  from 'path';
import React                 from 'react';
import ReactDOMServer        from 'react-dom/server';
import puppeteer             from 'puppeteer';

import FormRenderer          from '../../components/FormRenderer';
import { FIELD_MAP }         from '../../components/fieldMeta';
import { transformSanJae }   from '../../components/transformSanJae';
import { PAGE_A4 }           from '../../components/pageConfig';

const PAGE = PAGE_A4;

// ─────────────────────────────────────────────────────────────────────────────
// APP ROUTER HANDLER  (Next 13+ / app directory)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req) {
  const { data, debug = false } = await req.json();
  try {
    const pdf = await generatePDF(data, debug);
    return new Response(pdf, {
      status:  200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': 'attachment; filename="sanjae_form.pdf"',
      },
    });
  } catch (err) {
    console.error('[generate-pdf]', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status:  500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGES ROUTER HANDLER  (pages/ directory — uncomment to use)
// ─────────────────────────────────────────────────────────────────────────────
// export default async function handler(req, res) {
//   if (req.method !== 'POST') return res.status(405).end();
//   const { data, debug = false } = req.body;
//   try {
//     const pdf = await generatePDF(data, debug);
//     res.setHeader('Content-Type', 'application/pdf');
//     res.setHeader('Content-Disposition', 'attachment; filename="sanjae_form.pdf"');
//     res.send(pdf);
//   } catch (err) {
//     console.error('[generate-pdf]', err);
//     res.status(500).json({ error: err.message });
//   }
// }

// ─────────────────────────────────────────────────────────────────────────────
// generatePDF — public export (usable in tests, scripts, CLI tools)
// ─────────────────────────────────────────────────────────────────────────────
export async function generatePDF(formData, debug = false) {
  const html    = buildPageHTML(formData, debug);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({
      width:             PAGE.w,
      height:            PAGE.h,
      deviceScaleFactor: PAGE.scaleFactor,
    });

    // networkidle0 — waits for Google Fonts to finish loading
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 });

    // Explicit font-ready check on top of networkidle0
    await page.evaluate(() => document.fonts.ready);

    // 200ms settle — prevents rare blank-background race condition
    await new Promise(r => setTimeout(r, 200));

    const pdfBuffer = await page.pdf({
      width:             PAGE.printW,
      height:            PAGE.printH,
      printBackground:   true,   // required — renders background image
      margin:            { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: false,
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// buildPageHTML
//
// The only HTML construction in this file.
// Its only job is to provide the outer shell (doctype, head, fonts, CSS reset).
// ALL field rendering is delegated to FormRenderer via renderToString.
//
// ─── Why renderToString and not a URL navigation? ─────────────────────────────
//   page.goto(url) would require a running HTTP server and adds network latency.
//   renderToString is synchronous, zero-dependency, and produces byte-identical
//   output to what the browser renders — satisfying the "preview = PDF" goal.
//
// ─── Background image path ────────────────────────────────────────────────────
//   page.setContent() does not resolve relative paths.
//   We pass an absolute file:// URL as backgroundImage so Puppeteer can load it
//   directly from the filesystem without a server.
// ─────────────────────────────────────────────────────────────────────────────
function buildPageHTML(formData, debug) {
  // 1. Transform raw data — same function used by SanJaeForm in the browser
  const payload = transformSanJae(formData);

  // 2. Resolve background image to an absolute file:// URL
  //    process.cwd() = Next.js project root
  const bgAbsPath = path.resolve(process.cwd(), 'public', PAGE.background.replace(/^\//, ''));
  const bgFileURL = `file://${bgAbsPath}`;

  // 3. Render the exact same FormRenderer component tree used by the preview
  const formHTML = ReactDOMServer.renderToString(
    React.createElement(FormRenderer, {
      fieldMap:        FIELD_MAP,      // same FIELD_MAP as preview
      payload,                          // same transform output as preview
      page:            PAGE,            // same PAGE_A4 as preview
      backgroundImage: bgFileURL,       // absolute path for Puppeteer filesystem access
      debug,                            // false for production PDF, true for debug PDF
      id:              'form-page',
    })
  );

  // 4. Wrap in minimal HTML shell — only page-level setup, nothing field-specific
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <!--
    Noto Sans KR — full Hangul support.
    For air-gapped servers: replace with a local @font-face pointing to
    a downloaded woff2 file in /public/fonts/ and remove these tags.
  -->
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap" rel="stylesheet"/>
  <style>
    /* Hard reset — prevents any browser default margin/padding from shifting layout */
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    /* A4 page — zero margin, exact dimensions */
    @page {
      size: ${PAGE.printW} ${PAGE.printH};
      margin: 0;
    }

    /* Ensure background image prints — Puppeteer requires this explicitly */
    html, body {
      width: ${PAGE.w}px;
      height: ${PAGE.h}px;
      overflow: hidden;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  </style>
</head>
<body>
  ${formHTML}
</body>
</html>`;
}

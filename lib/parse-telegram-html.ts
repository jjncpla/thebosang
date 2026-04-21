/**
 * Telegram Desktop Export HTML 파서.
 * `<div class="message default clearfix">` 블록 단위로 메시지를 추출.
 * 포워드된 메시지는 원본 발신자·시간을 사용.
 */

export interface TelegramMessage {
  id: string
  text: string
  senderName: string
  date: Date | null
}

export function parseTelegramHtml(html: string): TelegramMessage[] {
  const messages: TelegramMessage[] = []
  // 첫 요소 기준으로 split — 첫 조각은 앞부분(page_header 등)
  const parts = html.split('<div class="message default')
  let lastSender = 'unknown'

  for (let i = 1; i < parts.length; i++) {
    const block = '<div class="message default' + parts[i]

    // id 추출
    const idMatch = block.match(/id="([^"]+)"/)
    const id = idMatch ? idMatch[1] : `msg-${i}`

    // service 메시지 스킵
    if (block.startsWith('<div class="message service')) continue

    const isJoined = /<div class="message default[^"]*\bjoined\b/.test(block)

    let text: string | null = null
    let senderName: string | null = null
    let dateStr: string | null = null

    // forwarded 블록이 있으면 원본 우선
    const fwdStart = block.indexOf('<div class="forwarded body">')
    if (fwdStart > -1) {
      const fwdBlock = block.slice(fwdStart)
      const fwdFrom = fwdBlock.match(/<div class="from_name[^"]*">\s*([\s\S]*?)<\/div>/)
      const fwdDate = fwdBlock.match(/<span class="date details"\s+title="([^"]+)"/)
      const fwdText = fwdBlock.match(/<div class="text"[^>]*>([\s\S]*?)<\/div>/)
      if (fwdFrom) {
        senderName = fwdFrom[1]
          .replace(/<span[\s\S]*?<\/span>/g, '')
          .replace(/<[^>]+>/g, '')
          .trim()
      }
      if (fwdDate) dateStr = fwdDate[1]
      if (fwdText) text = fwdText[1]
    }

    // forwarded 없거나 실패했으면 본체 메시지 추출
    if (!text) {
      const fromMatch = block.match(/<div class="from_name[^"]*">\s*([\s\S]*?)<\/div>/)
      const dateAttrMatch = block.match(/<div class="pull_right date details"\s+title="([^"]+)"/)
      const textMatch = block.match(/<div class="text"[^>]*>([\s\S]*?)<\/div>/)
      if (fromMatch && !senderName) senderName = fromMatch[1].replace(/<[^>]+>/g, '').trim()
      if (dateAttrMatch && !dateStr) dateStr = dateAttrMatch[1]
      if (textMatch) text = textMatch[1]
    }

    if (!text) continue

    // joined 메시지는 발신자 상속
    if ((!senderName || senderName === '') && isJoined) senderName = lastSender
    const finalSender = senderName || lastSender || 'unknown'
    if (finalSender && finalSender !== 'unknown') lastSender = finalSender

    const cleanText = htmlToPlainText(text)
    const date = dateStr ? parseTelegramDate(dateStr) : null

    messages.push({ id, text: cleanText, senderName: finalSender, date })
  }

  return messages
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function parseTelegramDate(s: string): Date | null {
  // "14.03.2019 18:35:13 UTC+09:00"
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (!m) return null
  const [, dd, mm, yyyy, hh, min, ss] = m
  const iso = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+09:00`
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

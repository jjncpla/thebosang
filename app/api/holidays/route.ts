import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = searchParams.get("year") ?? new Date().getFullYear().toString()
  const month = searchParams.get("month") ?? String(new Date().getMonth() + 1)

  const serviceKey = process.env.HOLIDAY_API_KEY
  if (!serviceKey) return NextResponse.json({})

  const url = `http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?serviceKey=${serviceKey}&solYear=${year}&solMonth=${String(month).padStart(2, "0")}&numOfRows=20&_type=json`

  try {
    const res = await fetch(url, { next: { revalidate: 86400 } })
    const data = await res.json()
    const items = data?.response?.body?.items?.item

    if (!items) return NextResponse.json({})

    const list = Array.isArray(items) ? items : [items]
    const result: Record<string, string> = {}
    for (const item of list) {
      if (item.isHoliday === "Y") {
        const d = String(item.locdate)
        const key = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
        result[key] = item.dateName
      }
    }
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({})
  }
}

'use client'

import { useState, useRef } from 'react'

interface ImportResult {
  total: number
  success: number
  skipped: number
  errors: { row: number; name: string; message: string }[]
  dryRun: boolean
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [availableSheets, setAvailableSheets] = useState<string[]>([])
  const [selectedSheets, setSelectedSheets] = useState<string[]>([])
  const [dryRun, setDryRun] = useState(true)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setResult(null)
    setAvailableSheets([])
    setSelectedSheets([])

    const fd = new FormData()
    fd.append('file', f)
    const res = await fetch('/api/cases/import/sheets', { method: 'POST', body: fd })
    if (res.ok) {
      const data = await res.json()
      setAvailableSheets(data.sheets || [])
      setSelectedSheets(data.sheets || [])
    }
  }

  const handleImport = async () => {
    if (!file || selectedSheets.length === 0) return
    setLoading(true)
    setResult(null)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('sheets', JSON.stringify(selectedSheets))
    fd.append('dryRun', String(dryRun))
    fd.append('skipDuplicates', String(skipDuplicates))

    try {
      const res = await fetch('/api/cases/import', { method: 'POST', body: fd })
      setResult(await res.json())
    } catch {
      alert('임포트 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const toggleSheet = (sheet: string) => {
    setSelectedSheets(prev =>
      prev.includes(sheet) ? prev.filter(s => s !== sheet) : [...prev, sheet]
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">사건 데이터 일괄 임포트</h1>
        <p className="text-sm text-gray-500 mt-1">엑셀 파일 업로드 → 시트 선택 → 테스트 실행 후 실제 저장</p>
      </div>

      {/* 파일 업로드 */}
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-[#29ABE2] mb-4 transition-colors"
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
        <div className="text-3xl mb-2">📂</div>
        {file
          ? <p className="text-green-600 font-medium">{file.name}</p>
          : <p className="text-gray-400 text-sm">클릭하여 엑셀 파일 선택 (.xlsx)</p>
        }
      </div>

      {/* 시트 선택 */}
      {availableSheets.length > 0 && (
        <div className="mb-4 p-4 bg-gray-50 rounded-xl border">
          <p className="text-sm font-medium text-gray-700 mb-2">
            임포트할 시트 ({selectedSheets.length}/{availableSheets.length} 선택)
          </p>
          <div className="flex flex-wrap gap-2">
            {availableSheets.map(s => (
              <label key={s} className="flex items-center gap-1.5 text-sm bg-white border rounded-lg px-3 py-1.5 cursor-pointer hover:bg-blue-50">
                <input type="checkbox" checked={selectedSheets.includes(s)} onChange={() => toggleSheet(s)} />
                {s}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 옵션 */}
      <div className="flex gap-6 mb-4 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
          <span className={dryRun ? 'text-orange-600 font-medium' : 'text-gray-600'}>
            테스트 실행 (저장 안 함)
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={skipDuplicates} onChange={e => setSkipDuplicates(e.target.checked)} />
          <span className="text-gray-600">중복 주민번호 건너뛰기</span>
        </label>
      </div>

      {/* 실행 버튼 */}
      <button
        onClick={handleImport}
        disabled={!file || loading || selectedSheets.length === 0}
        className={`w-full py-3 rounded-xl font-semibold text-white transition-colors disabled:opacity-40 ${
          dryRun ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#29ABE2] hover:bg-[#1a9fd4]'
        }`}
      >
        {loading ? '처리 중...' : dryRun ? '테스트 실행' : '실제 임포트'}
      </button>

      {/* 결과 */}
      {result && (
        <div className="mt-6 border rounded-xl overflow-hidden">
          <div className={`px-4 py-3 font-semibold text-sm ${result.dryRun ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
            {result.dryRun ? '테스트 결과' : '임포트 완료'}
          </div>
          <div className="p-4">
            <div className="grid grid-cols-4 gap-3 mb-4 text-center">
              {[
                { label: '전체', value: result.total, color: 'text-blue-600' },
                { label: '성공', value: result.success, color: 'text-green-600' },
                { label: '중복 skip', value: result.skipped, color: 'text-gray-500' },
                { label: '오류', value: result.errors.length, color: 'text-red-500' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-gray-400">{label}</div>
                </div>
              ))}
            </div>

            {result.errors.length > 0 && (
              <div>
                <p className="text-sm font-medium text-red-600 mb-2">오류 목록</p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">
                      {e.row}행 [{e.name}]: {e.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!result.dryRun && result.success > 0 && (
              <a href="/cases" className="mt-3 block text-center text-sm text-[#29ABE2] hover:underline">
                사건 목록에서 확인하기 →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

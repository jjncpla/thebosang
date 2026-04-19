'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useBranches } from '@/lib/hooks/useBranches'

interface PreviewRow {
  name: string
  ssn: string
  phone: string | null
  referrer: string | null
  bigWorkplace: string | null
  memo: string | null
}

interface ImportResult {
  sheet: string
  total: number
  success: number
  skipped: number
  errors: { row: number; name: string; message: string }[]
  dryRun: boolean
  preview: PreviewRow[]
}

function maskSsn(ssn: string) {
  return ssn.replace(/(\d{6})-?(\d{7})/, '$1-*******')
}

export default function ImportSmallPage() {
  const { tfByBranch, tfToBranch, loading: branchesLoading } = useBranches()
  const fileRef = useRef<HTMLInputElement>(null)

  const [branch, setBranch] = useState('')
  const [tfName, setTfName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dryRun, setDryRun] = useState(true)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tfList = branch ? tfByBranch[branch] ?? [] : []
  const branchNames = useMemo(() => Object.keys(tfByBranch), [tfByBranch])

  const canSubmit = !!file && !!tfName && !!branch && !loading

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setFile(f ?? null)
    setResult(null)
    setError(null)
  }

  const handleTfChange = (tf: string) => {
    setTfName(tf)
    // TF에서 역으로 지사 확인 (지사 선택과 불일치하면 동기화)
    const mapped = tfToBranch[tf]
    if (mapped && mapped !== branch) setBranch(mapped)
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setResult(null)
    setError(null)

    const fd = new FormData()
    fd.append('file', file!)
    fd.append('tfName', tfName)
    fd.append('branch', branch)
    fd.append('dryRun', String(dryRun))
    fd.append('skipDuplicates', String(skipDuplicates))

    try {
      const res = await fetch('/api/cases/import-small', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || '임포트 실패')
      } else {
        setResult(data)
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] tracking-widest text-gray-400 font-bold">CASE IMPORT</p>
          <h1 className="text-xl font-extrabold text-[#005530] mt-1">소량 사건 임포트 (소음성 난청)</h1>
          <p className="text-sm text-gray-500 mt-1">
            이산 신규 사건(2주 단위 10~100건)을 TF별로 일괄 등록합니다. 모든 사건은 <b>접수 대기</b> 상태로 생성됩니다.
          </p>
        </div>
        <Link
          href="/cases"
          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md px-3 py-1.5 bg-white"
        >
          ← 사건 목록
        </Link>
      </div>

      {/* Step 1: 지사 · TF 선택 */}
      <div className="bg-white border rounded-xl p-4 mb-3 shadow-sm">
        <div className="text-[11px] font-bold text-gray-500 mb-2">① 지사 · TF 선택</div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-[11px] text-gray-500 font-semibold mb-1">지사</label>
            <select
              value={branch}
              onChange={(e) => { setBranch(e.target.value); setTfName('') }}
              disabled={branchesLoading}
              className="border rounded-md px-3 py-1.5 text-sm bg-gray-50 min-w-[220px]"
            >
              <option value="">지사 선택</option>
              {branchNames.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 font-semibold mb-1">TF</label>
            <select
              value={tfName}
              onChange={(e) => handleTfChange(e.target.value)}
              disabled={!branch || tfList.length === 0}
              className="border rounded-md px-3 py-1.5 text-sm bg-gray-50 min-w-[200px] disabled:opacity-50"
            >
              <option value="">TF 선택</option>
              {tfList.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Step 2: 파일 선택 */}
      <div className="bg-white border rounded-xl p-4 mb-3 shadow-sm">
        <div className="text-[11px] font-bold text-gray-500 mb-2">② 엑셀 파일 업로드</div>
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-[#29ABE2] transition-colors"
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
          <div className="text-2xl mb-1">📂</div>
          {file
            ? <p className="text-green-600 font-medium text-sm">{file.name}</p>
            : <p className="text-gray-400 text-xs">클릭하여 엑셀 파일 선택 (.xlsx / .xls)</p>
          }
        </div>
        <div className="mt-3 text-[11px] text-gray-500 leading-relaxed">
          <b>인식 컬럼</b>: 연번 · 성명 · 주민번호 · 연락처 · 소개자 · 비고 · 대형사업장<br />
          헤더 행은 자동 탐지됩니다 (성명·주민번호 포함 행). 여러 시트가 있으면 데이터가 가장 많은 시트를 사용합니다.
        </div>
      </div>

      {/* Step 3: 옵션 · 실행 */}
      <div className="bg-white border rounded-xl p-4 mb-3 shadow-sm">
        <div className="text-[11px] font-bold text-gray-500 mb-2">③ 옵션 · 실행</div>
        <div className="flex flex-wrap gap-5 text-sm mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            <span className={dryRun ? 'text-orange-600 font-medium' : 'text-gray-600'}>
              테스트 실행 (저장 안 함)
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} />
            <span className="text-gray-600">같은 재해자의 소음성 난청 사건이 이미 있으면 건너뛰기</span>
          </label>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-2.5 rounded-lg font-semibold text-white text-sm transition-colors disabled:opacity-40 ${
            dryRun ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#29ABE2] hover:bg-[#1a9fd4]'
          }`}
        >
          {loading ? '처리 중...' : dryRun ? '테스트 실행' : '실제 임포트'}
        </button>
        {!canSubmit && !loading && (
          <p className="mt-2 text-[11px] text-gray-400">
            {!branch ? '지사를 선택해주세요.' : !tfName ? 'TF를 선택해주세요.' : !file ? '엑셀 파일을 선택해주세요.' : ''}
          </p>
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          ⚠ {error}
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div className="mt-4 border rounded-xl overflow-hidden">
          <div className={`px-4 py-3 font-semibold text-sm ${result.dryRun ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
            {result.dryRun ? '테스트 결과' : '임포트 완료'}
            <span className="ml-2 text-xs text-gray-500">시트: {result.sheet}</span>
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

            {result.preview.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-600 mb-1.5">미리보기 (처음 {result.preview.length}건)</p>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        {['성명', '주민번호', '연락처', '소개자', '대형사업장', '비고'].map((h) => (
                          <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.preview.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1.5 font-medium">{r.name}</td>
                          <td className="px-2 py-1.5 font-mono text-gray-600">{maskSsn(r.ssn)}</td>
                          <td className="px-2 py-1.5 text-gray-600">{r.phone ?? '-'}</td>
                          <td className="px-2 py-1.5 text-gray-600">{r.referrer ?? '-'}</td>
                          <td className="px-2 py-1.5 text-gray-600">{r.bigWorkplace ?? '-'}</td>
                          <td className="px-2 py-1.5 text-gray-500 truncate max-w-[320px]" title={r.memo ?? ''}>{r.memo ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.errors.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-600 mb-1.5">오류 목록</p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                      {e.row}행 [{e.name}]: {e.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!result.dryRun && result.success > 0 && (
              <Link href={`/cases?tfName=${encodeURIComponent(tfName)}`} className="mt-3 block text-center text-sm text-[#29ABE2] hover:underline">
                사건 목록에서 확인하기 →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useRef } from 'react'

interface FileResult {
  name: string
  size: number
  status: 'pending' | 'processing' | 'done' | 'error'
  stats?: {
    totalMessages: number
    filtered: number
    savedNew: number
    skippedDuplicate: number
    parseFailures: number
  }
  error?: string
}

type TfOrg = 'neutral' | '이산' | '더보상'

export default function BackfillPage() {
  const [files, setFiles] = useState<File[]>([])
  const [tfOrg, setTfOrg] = useState<TfOrg>('neutral')
  const [results, setResults] = useState<FileResult[]>([])
  const [processing, setProcessing] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function addFiles(list: FileList | File[]) {
    const arr = Array.from(list).filter(f => f.name.toLowerCase().endsWith('.html'))
    // 중복 파일명 제거
    setFiles(prev => {
      const names = new Set(prev.map(p => p.name))
      const added = arr.filter(f => !names.has(f.name))
      return [...prev, ...added].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  function clearAll() {
    setFiles([])
    setResults([])
    setCurrentIdx(-1)
  }

  async function handleStart() {
    if (!files.length || processing) return
    setProcessing(true)

    const init: FileResult[] = files.map(f => ({
      name: f.name,
      size: f.size,
      status: 'pending',
    }))
    setResults(init)

    for (let i = 0; i < files.length; i++) {
      setCurrentIdx(i)
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'processing' } : r))

      const fd = new FormData()
      fd.append('file', files[i])
      fd.append('tfOrg', tfOrg)

      try {
        const res = await fetch('/api/tf/special-clinic/backfill', {
          method: 'POST',
          body: fd,
        })
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          throw new Error(`HTTP ${res.status} ${body.slice(0, 80)}`)
        }
        const data = await res.json()
        setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'done', stats: data.stats } : r))
      } catch (e) {
        setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'error', error: String(e) } : r))
      }
    }

    setCurrentIdx(-1)
    setProcessing(false)
  }

  const totals = results.reduce((acc, r) => {
    if (r.stats) {
      acc.totalMessages += r.stats.totalMessages
      acc.filtered += r.stats.filtered
      acc.savedNew += r.stats.savedNew
      acc.skippedDuplicate += r.stats.skippedDuplicate
      acc.parseFailures += r.stats.parseFailures
    }
    return acc
  }, { totalMessages: 0, filtered: 0, savedNew: 0, skippedDuplicate: 0, parseFailures: 0 })

  const doneCount = results.filter(r => r.status === 'done' || r.status === 'error').length
  const progressPct = results.length ? Math.round((doneCount / results.length) * 100) : 0

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-800">특진 일정 백필 (HTML 일괄 임포트)</h1>
        <p className="text-sm text-gray-600 mt-1">
          Telegram Desktop에서 Export한 HTML 파일들을 업로드하면 과거 특진/재특진 일정을 일괄 등록합니다.
          <br />중복 일정(<b>환자명 + TF + 유형 + 회차</b> 동일)은 자동 스킵됩니다.
        </p>
      </div>

      {/* 조직 선택 */}
      <div className="border rounded-lg p-3 bg-white">
        <div className="text-sm font-medium text-gray-700 mb-2">메시지 출처</div>
        <div className="flex gap-4 flex-wrap text-sm">
          {([
            ['neutral', '통합방', 'TF명 원본 그대로 (예: 울산TF, 진폐TF)'],
            ['이산', '이산 전용방', '접두어 없는 TF에 "이산" 자동 부여'],
            ['더보상', '더보상 전용방', '접두어 없는 TF에 "더보상" 자동 부여'],
          ] as const).map(([val, label, desc]) => (
            <label key={val} className="flex items-start gap-1.5 cursor-pointer" title={desc}>
              <input
                type="radio"
                name="tfOrg"
                checked={tfOrg === val}
                onChange={() => setTfOrg(val)}
                className="mt-0.5"
                disabled={processing}
              />
              <div>
                <div className="text-gray-800">{label}</div>
                <div className="text-[11px] text-gray-500">{desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 드롭 영역 */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-10 text-center bg-white transition-colors ${dragOver ? 'border-sky-500 bg-sky-50' : 'border-gray-300 hover:border-sky-400'}`}
      >
        <p className="text-gray-500 text-sm mb-3">HTML 파일을 여기로 드래그하거나 아래 버튼 클릭</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".html"
          onChange={e => e.target.files && addFiles(e.target.files)}
          className="hidden"
          disabled={processing}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={processing}
          className="inline-block px-4 py-2 bg-sky-500 text-white rounded cursor-pointer hover:bg-sky-600 text-sm disabled:opacity-50"
        >
          파일 선택
        </button>
        <div className="text-[11px] text-gray-400 mt-2">messages.html, messages2.html ... 여러 개 한 번에 선택 가능</div>
      </div>

      {/* 파일 목록 (처리 전) */}
      {files.length > 0 && !processing && results.length === 0 && (
        <div className="border rounded-lg bg-white">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
            <span className="text-sm font-medium">선택된 파일 {files.length}개</span>
            <button onClick={clearAll} className="text-xs text-red-500 hover:underline">전체 제거</button>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs border-b last:border-b-0">
                <span className="truncate flex-1">{f.name}</span>
                <span className="text-gray-400 ml-2">{(f.size / 1024).toFixed(0)}KB</span>
                <button onClick={() => removeFile(i)} className="ml-2 text-gray-400 hover:text-red-500">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 시작 버튼 */}
      {files.length > 0 && !processing && results.length === 0 && (
        <button
          onClick={handleStart}
          className="w-full py-2.5 bg-amber-500 text-white rounded hover:bg-amber-600 font-medium text-sm"
        >
          백필 시작 ({files.length}개 파일 순차 처리)
        </button>
      )}

      {/* 진행 & 결과 */}
      {results.length > 0 && (
        <div className="border rounded-lg bg-white">
          <div className="px-3 py-2 border-b bg-gray-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {processing ? `처리 중... (${Math.max(0, currentIdx) + 1}/${results.length})` : `완료 (${doneCount}/${results.length})`}
              </span>
              {!processing && (
                <button
                  onClick={() => { setResults([]); setCurrentIdx(-1) }}
                  className="text-xs text-gray-500 hover:underline"
                >결과 지우기</button>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-sky-500 h-1.5 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="text-xs text-gray-600">
              파싱 대상 메시지 <b>{totals.filtered.toLocaleString()}</b>건 /
              저장 <b className="text-green-600">{totals.savedNew.toLocaleString()}</b>건 /
              중복 스킵 <b className="text-gray-500">{totals.skippedDuplicate.toLocaleString()}</b>건 /
              파싱 실패 <b className="text-amber-600">{totals.parseFailures.toLocaleString()}</b>건
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs border-b last:border-b-0">
                <span className="w-4 text-center">
                  {r.status === 'pending' && '⏳'}
                  {r.status === 'processing' && '⚙️'}
                  {r.status === 'done' && '✅'}
                  {r.status === 'error' && '❌'}
                </span>
                <span className="truncate flex-1">{r.name}</span>
                {r.stats && (
                  <span className="text-gray-500 text-[11px] whitespace-nowrap">
                    {r.stats.filtered}건 대상 → <span className="text-green-600 font-medium">{r.stats.savedNew}</span> 저장 · <span className="text-gray-500">{r.stats.skippedDuplicate}</span> 중복 · <span className="text-amber-600">{r.stats.parseFailures}</span> 실패
                  </span>
                )}
                {r.error && <span className="text-red-500 text-[11px]">{r.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

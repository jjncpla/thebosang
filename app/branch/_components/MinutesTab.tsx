'use client'

import { useState } from 'react'

type MinuteCategory =
  | 'executive'       // 간부회의
  | 'regional_chief'  // 권역지사장 회의록
  | 'branch_metro'    // 수도권역
  | 'branch_gyeongnam' // 경남권역
  | 'branch_gyeongbuk' // 경북권역
  | 'branch_jeolla'   // 전라권역

const CATEGORIES: { id: MinuteCategory; label: string; sub?: boolean }[] = [
  { id: 'executive',       label: '간부회의' },
  { id: 'regional_chief',  label: '권역지사장 회의록' },
  { id: 'branch_metro',    label: '수도권역',   sub: true },
  { id: 'branch_gyeongnam', label: '경남권역',  sub: true },
  { id: 'branch_gyeongbuk', label: '경북권역',  sub: true },
  { id: 'branch_jeolla',   label: '전라권역',   sub: true },
]

export default function MinutesTab() {
  const [active, setActive] = useState<MinuteCategory>('executive')

  return (
    <div className="p-4 space-y-4">
      {/* 카테고리 네비 */}
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActive(cat.id)}
            className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors border ${
              active === cat.id
                ? 'bg-sky-500 text-white border-sky-500'
                : 'bg-white text-gray-600 border-gray-300 hover:border-sky-400 hover:text-sky-600'
            } ${cat.sub ? 'ml-2' : ''}`}
          >
            {cat.sub ? `└ ${cat.label}` : cat.label}
          </button>
        ))}
      </div>

      {/* 권역별 지사장 회의록 안내 */}
      {['branch_metro', 'branch_gyeongnam', 'branch_gyeongbuk', 'branch_jeolla'].includes(active) && (
        <p className="text-xs text-gray-400">
          권역별 지사장 회의록 — {CATEGORIES.find(c => c.id === active)?.label}
        </p>
      )}

      {/* 회의록 목록 (빈 상태) */}
      <div className="border border-dashed border-gray-200 rounded-lg py-12 flex flex-col items-center justify-center gap-2">
        <span className="text-3xl">📋</span>
        <p className="text-sm text-gray-500 font-medium">등록된 회의록이 없습니다</p>
        <p className="text-xs text-gray-400">관리자 페이지에서 회의록을 등록할 수 있습니다</p>
      </div>

      {/*
        회의록 목록은 추후 MinutesRecord DB 테이블 연동 예정.
        각 회의록은: id, category, title, date, content(text), attachmentUrl(선택)
        현재는 빈 상태로 UI 구조만 제공.
      */}
    </div>
  )
}

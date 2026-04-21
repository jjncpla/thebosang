'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BranchesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const tabs = [
    { href: '/admin/branches', label: '지사 관리' },
    { href: '/admin/branches/tf', label: 'TF 관리' },
  ]

  return (
    <div>
      <div className="border-b bg-white px-4">
        <nav className="flex gap-1">
          {tabs.map(t => {
            const isActive = pathname === t.href
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t.label}
              </Link>
            )
          })}
        </nav>
      </div>
      {children}
    </div>
  )
}

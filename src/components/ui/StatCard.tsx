import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  subvalue?: string
  icon?: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  className?: string
  accent?: string
}

export function StatCard({
  label,
  value,
  subvalue,
  icon: Icon,
  trend,
  trendLabel,
  className,
  accent,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:shadow-[0_4px_16px_rgba(16,24,40,0.08)] transition-shadow duration-200 p-6',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] mb-1.5">{label}</p>
          <p className="font-display text-[26px] font-extrabold text-gray-900 truncate tracking-tight tabular-nums">{value}</p>
          {subvalue && (
            <p className="text-xs text-gray-400 mt-1">{subvalue}</p>
          )}
          {trendLabel && (
            <p
              className={cn('text-xs mt-2 font-medium', {
                'text-green-600': trend === 'up',
                'text-red-600': trend === 'down',
                'text-gray-500': trend === 'neutral',
              })}
            >
              {trend === 'up' && '↑ '}
              {trend === 'down' && '↓ '}
              {trendLabel}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-4"
            style={{ backgroundColor: accent || '#e8eef5' }}
          >
            <Icon
              className="w-5 h-5"
              style={{ color: accent ? '#fff' : '#1e3a5f' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { Table, type Column } from '@/components/ui/Table'
import { ActiveBadge, ServiceTypeBadge } from '@/components/ui/Badge'
import { formatAUD } from '@/lib/formatters'
import {
  FREQUENCY_LABELS,
  HEALTH_STATUS_LABELS,
  HEALTH_STATUS_COLORS,
  HEALTH_STATUS_DOT,
} from '@/lib/constants'
import { computeClientHealth } from '@/lib/health'
import { Clock } from 'lucide-react'
import type { Client, HealthStatus } from '@/types/app'

type ClientRow = Client & {
  margin_pct?: number | null
  profile_complete?: boolean
  monthly_profit?: number | null
  contract_expiry_date?: string | null
  latestSurveyAvg?: number | null
}

interface ClientTableProps {
  clients: ClientRow[]
  thresholds?: { red: number; yellow: number }
}

export function ClientTable({ clients, thresholds = { red: 24, yellow: 40 } }: ClientTableProps) {
  const router = useRouter()

  const columns: Column<ClientRow>[] = [
    {
      key: 'business_name',
      header: 'Business',
      sortable: true,
      render: c => (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900">{c.business_name}</p>
            {(c as any).surveyPending && (
              <span title="Survey sent — awaiting response" className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                <Clock className="w-3 h-3" />
                Survey pending
              </span>
            )}
          </div>
          {c.contact_name && <p className="text-xs text-gray-500">{c.contact_name}</p>}
        </div>
      ),
    },
    {
      key: 'service_type',
      header: 'Service',
      render: c => (
        <div className="flex flex-wrap gap-1">
          {((c.service_type as string[]) || []).slice(0, 2).map(s => (
            <ServiceTypeBadge key={s} type={s as any} />
          ))}
          {((c.service_type as string[]) || []).length > 2 && (
            <span className="text-xs text-gray-400">+{((c.service_type as string[]) || []).length - 2}</span>
          )}
        </div>
      ),
    },
    {
      key: 'frequency',
      header: 'Frequency',
      render: c => (c as any).is_multi_site && !c.frequency
        ? <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Multi-site</span>
        : (c.frequency ? FREQUENCY_LABELS[c.frequency] : '—'),
    },
    {
      key: 'monthly_value',
      header: 'MRR',
      sortable: true,
      className: 'text-right',
      headerClassName: 'text-right',
      render: c => (
        <span className="block text-right font-semibold text-gray-900">
          {c.monthly_value ? formatAUD(c.monthly_value) : '—'}
        </span>
      ),
    },
    {
      key: 'margin_pct' as any,
      header: 'Margin',
      sortable: false,
      className: 'text-right',
      headerClassName: 'text-right',
      render: c => {
        const m = c.margin_pct
        if (m == null) {
          return <span className="block text-right text-xs text-gray-400">No data</span>
        }
        const color = m < thresholds.red ? 'text-red-600' : m < thresholds.yellow ? 'text-amber-400' : 'text-emerald-600'
        return (
          <span className={`block text-right font-bold tabular-nums ${color}`}>
            {m.toFixed(0)}%
          </span>
        )
      },
    },
    {
      key: 'active' as any,
      header: 'Health',
      render: c => {
        const h = computeClientHealth(
          {
            id: c.id,
            business_name: c.business_name,
            active: c.active ?? false,
            margin_pct: c.margin_pct ?? null,
            profile_complete: c.profile_complete ?? false,
            contract_expiry_date: (c as any).contract_expiry_date ?? null,
          },
          c.latestSurveyAvg ?? null,
          thresholds
        )
        const label = HEALTH_STATUS_LABELS[h.status]
        const color = HEALTH_STATUS_COLORS[h.status]
        const dot   = HEALTH_STATUS_DOT[h.status]
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            {label}
          </span>
        )
      },
    },
  ]

  return (
    <Table
      data={clients}
      columns={columns}
      keyExtractor={c => c.id}
      onRowClick={c => router.push(`/clients/${c.id}`)}
      emptyMessage="No clients found. Adjust your filters or add a new client."
    />
  )
}

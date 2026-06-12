import { formatAUD, formatAUDCompact } from '@/lib/formatters'
import { VALUATION_MULTIPLE } from '@/lib/constants'

interface KPIGridProps {
  activeClients:     number
  mrr:               number
  netMonthlyProfit:  number | null
  avgMarginPct:      number | null
  valuationMultiple?: number
}

function KPITile({
  label,
  value,
  subtext,
  valueColor = 'text-gray-900',
  accentBar,
}: {
  label: string
  value: string
  subtext?: string
  valueColor?: string
  accentBar?: string
}) {
  return (
    <div className="group bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:shadow-[0_4px_16px_rgba(16,24,40,0.08)] hover:-translate-y-0.5 transition-all duration-200 p-5 relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-full h-[3px] ${accentBar ?? 'bg-[#1e3a5f]/15'}`} />
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em]">{label}</p>
      <p className={`font-display text-[28px] font-extrabold mt-2.5 leading-none tabular-nums tracking-tight ${valueColor}`}>{value}</p>
      {subtext && <p className="text-xs text-gray-400 mt-2.5">{subtext}</p>}
    </div>
  )
}

export function KPIGrid({ activeClients, mrr, netMonthlyProfit, avgMarginPct, valuationMultiple }: KPIGridProps) {
  const multiple  = valuationMultiple ?? VALUATION_MULTIPLE
  const valuation = mrr * 12 * multiple

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <KPITile
        label="Active Clients"
        value={String(activeClients)}
        subtext={`Est. biz value ${formatAUDCompact(valuation)}`}
      />
      <KPITile
        label="Monthly Revenue"
        value={formatAUD(mrr)}
        subtext={`${formatAUDCompact(mrr * 12)} ARR`}
      />
      <KPITile
        label="Net Profit / Month"
        value={netMonthlyProfit != null ? formatAUD(netMonthlyProfit) : '—'}
        subtext={
          netMonthlyProfit == null
            ? 'Add cost data to unlock'
            : `${formatAUDCompact(netMonthlyProfit * 12)} / year`
        }
        valueColor={
          netMonthlyProfit == null ? 'text-gray-300'
            : netMonthlyProfit < 0 ? 'text-red-600'
            : 'text-emerald-600'
        }
        accentBar={
          netMonthlyProfit == null ? undefined
            : netMonthlyProfit < 0 ? 'bg-red-500'
            : 'bg-emerald-500'
        }
      />
      <KPITile
        label="Avg Gross Margin"
        value={avgMarginPct != null ? `${avgMarginPct.toFixed(0)}%` : '—'}
        subtext={
          avgMarginPct == null ? 'Incomplete cost data'
            : avgMarginPct >= 40 ? 'Healthy'
            : avgMarginPct >= 24 ? 'Watch closely'
            : 'Critical — review costs'
        }
        valueColor={
          avgMarginPct == null ? 'text-gray-300'
            : avgMarginPct < 24 ? 'text-red-600'
            : avgMarginPct < 40 ? 'text-amber-600'
            : 'text-emerald-600'
        }
        accentBar={
          avgMarginPct == null ? undefined
            : avgMarginPct < 24 ? 'bg-red-500'
            : avgMarginPct < 40 ? 'bg-amber-500'
            : 'bg-emerald-500'
        }
      />
    </div>
  )
}

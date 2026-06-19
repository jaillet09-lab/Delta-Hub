'use client'

import { formatAUD } from '@/lib/formatters'
import type { Client } from '@/types/app'

interface ClientRevenueBreakdownProps {
  clients: Client[]
}

function MarginBar({ pct }: { pct: number }) {
  const color = pct >= 55 ? '#16a34a' : pct >= 35 ? '#d97706' : '#dc2626'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: '#F0EFEC', borderRadius: 2, overflow: 'hidden', minWidth: 60 }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, minWidth: 34, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
    </div>
  )
}

export function ClientRevenueBreakdown({ clients }: ClientRevenueBreakdownProps) {
  const active = clients
    .filter((c) => c.active)
    .map((c, i) => {
      const monthly = c.monthly_value || 0
      const hourlyRate = (c as any).cleaner_hourly_rate || 0
      const hoursPerVisit = (c as any).cleaner_hours_per_visit || 0

      // visits per month from frequency
      const freqMultipliers: Record<string, number> = {
        daily: 365 / 12,
        weekly: 52 / 12,
        fortnightly: 26 / 12,
        monthly: 1,
        quarterly: 4 / 12,
        annual: 1 / 12,
        one_off: 1,
      }
      const dpw = (c as any).days_per_week && (c as any).days_per_week > 0 ? (c as any).days_per_week : 1
      const perDay = c.frequency ? (freqMultipliers[c.frequency] ?? 1) : 1
      const visitsPerMonth = (c.frequency === 'weekly' || c.frequency === 'fortnightly') ? perDay * dpw : perDay
      const computedCost = hourlyRate * hoursPerVisit * visitsPerMonth

      // Prefer the stored aggregated figures (these already roll up every site
      // for multi-site clients). Fall back to the per-visit computation only
      // when no stored cost exists.
      const storedCost   = (c as any).monthly_labour_cost
      const storedProfit = (c as any).monthly_profit
      const storedMargin = (c as any).margin_pct

      const cleanerCostPerMonth = storedCost != null ? Number(storedCost) : computedCost
      const grossProfit = storedProfit != null ? Number(storedProfit) : (monthly - cleanerCostPerMonth)
      const marginPct = storedMargin != null
        ? Number(storedMargin)
        : (monthly > 0 ? (grossProfit / monthly) * 100 : 0)

      return { ...c, monthly, cleanerCostPerMonth, grossProfit, marginPct, isMultiSite: (c as any).is_multi_site === true }
    })
    .sort((a, b) => b.monthly - a.monthly)

  const totalMRR = active.reduce((s, c) => s + c.monthly, 0)

  if (active.length === 0) {
    return <p className="text-center text-sm text-gray-400 py-8">No active clients.</p>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #F0EFEC' }}>
            {['#', 'Client', 'Frequency', 'Rate/Visit', 'Cleaner Cost/Mo', 'MRR', 'Profit/Mo', 'Margin'].map((h, i) => (
              <th key={h} style={{
                padding: '9px 14px',
                textAlign: i >= 3 ? 'right' : 'left',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#AAAAAA',
                whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {active.map((c, i) => {
            const share = totalMRR > 0 ? (c.monthly / totalMRR) * 100 : 0
            return (
              <tr key={c.id} style={{ borderBottom: '1px solid #F7F6F4' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFAF8')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '10px 14px', color: '#AAAAAA', fontWeight: 700, fontSize: 11 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <p style={{ fontWeight: 600, color: '#111111', marginBottom: 1 }}>{c.business_name}</p>
                  <p style={{ fontSize: 10.5, color: '#AAAAAA' }}>{share.toFixed(1)}% of MRR</p>
                </td>
                <td style={{ padding: '10px 14px', color: '#777772', textTransform: 'capitalize' }}>
                  {(c as any).isMultiSite ? 'Multi-site' : (c.frequency?.replace('_', ' ') || '—')}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: '#111111' }}>
                  {(c as any).isMultiSite ? 'Per site' : (c.rate_per_visit ? formatAUD(c.rate_per_visit) : '—')}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  {c.cleanerCostPerMonth > 0 ? (
                    <div>
                      <p style={{ color: '#dc2626', fontWeight: 500 }}>{formatAUD(c.cleanerCostPerMonth)}</p>
                      {(c as any).cleaner_hourly_rate > 0 && (
                        <p style={{ fontSize: 10, color: '#AAAAAA' }}>
                          ${(c as any).cleaner_hourly_rate}/hr × {(c as any).cleaner_hours_per_visit}h
                        </p>
                      )}
                    </div>
                  ) : <span style={{ color: '#AAAAAA' }}>—</span>}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#1e3a5f' }}>
                  {formatAUD(c.monthly)}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  {c.cleanerCostPerMonth > 0 ? (
                    <span style={{ fontWeight: 600, color: c.grossProfit >= 0 ? '#16a34a' : '#dc2626' }}>
                      {formatAUD(c.grossProfit)}
                    </span>
                  ) : <span style={{ color: '#AAAAAA' }}>—</span>}
                </td>
                <td style={{ padding: '10px 14px', minWidth: 130 }}>
                  {c.cleanerCostPerMonth > 0 ? <MarginBar pct={c.marginPct} /> : <span style={{ color: '#AAAAAA', fontSize: 11 }}>—</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #E8E6E2', background: '#FAFAF8' }}>
            <td colSpan={5} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#777772', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Total MRR ({active.length} clients)
            </td>
            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: '#1e3a5f' }}>
              {formatAUD(totalMRR)}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

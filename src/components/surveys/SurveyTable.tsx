'use client'

import { useState } from 'react'
import { Table, type Column } from '@/components/ui/Table'
import { formatDate } from '@/lib/formatters'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Survey } from '@/types/app'
import { deleteSurveyAction } from '@/actions/surveys'

type SurveyWithClient = Survey & {
  clients: { business_name: string; ref_number: string | null } | null
}

interface SurveyTableProps {
  surveys: SurveyWithClient[]
}

function ScoreCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-300">—</span>
  return (
    <span className={cn(
      'font-bold text-sm',
      score >= 8 ? 'text-green-600' : score >= 7 ? 'text-amber-500' : 'text-red-600'
    )}>
      {score}
    </span>
  )
}

function isAtRisk(s: Survey) {
  return [s.quality_score, s.reliability_score, s.communication_score, s.value_score]
    .some((x) => x != null && x < 7)
}

function avgScore(s: Survey) {
  const scores = [s.quality_score, s.reliability_score, s.communication_score, s.value_score]
    .filter((x): x is number => x != null)
  if (!scores.length) return null
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

function DeleteButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={async () => {
            setDeleting(true)
            await deleteSurveyAction(id)
          }}
          disabled={deleting}
          className="text-xs text-red-600 font-semibold hover:text-red-800 disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Confirm'}
        </button>
        <span className="text-gray-300">·</span>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-gray-300 hover:text-red-500 transition-colors"
      title="Delete survey"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}

export function SurveyTable({ surveys }: SurveyTableProps) {
  const columns: Column<SurveyWithClient>[] = [
    {
      key: 'submitted_at',
      header: 'Date',
      sortable: true,
      render: (s) => formatDate(s.submitted_at),
    },
    {
      key: 'clients',
      header: 'Client',
      sortable: true,
      render: (s) => (
        <div>
          <p className="font-medium text-gray-900">{s.clients?.business_name || '—'}</p>
          {isAtRisk(s) && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
              <AlertTriangle className="w-3 h-3" />
              At risk
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'quality_score',
      header: 'Quality',
      render: (s) => <ScoreCell score={s.quality_score} />,
    },
    {
      key: 'reliability_score',
      header: 'Reliability',
      render: (s) => <ScoreCell score={s.reliability_score} />,
    },
    {
      key: 'communication_score',
      header: 'Communication',
      render: (s) => <ScoreCell score={s.communication_score} />,
    },
    {
      key: 'value_score',
      header: 'Value',
      render: (s) => <ScoreCell score={s.value_score} />,
    },
    {
      key: 'id',
      header: 'Avg',
      render: (s) => {
        const avg = avgScore(s)
        return avg == null ? <span className="text-gray-300">—</span> : (
          <span className={cn('font-bold', avg >= 8 ? 'text-green-600' : avg >= 7 ? 'text-amber-500' : 'text-red-600')}>
            {avg.toFixed(1)}
          </span>
        )
      },
    },
    {
      key: 'comments',
      header: 'Comments',
      render: (s) => s.comments ? (
        <span className="text-xs text-gray-500 italic truncate max-w-48 block">{s.comments}</span>
      ) : <span className="text-gray-300">—</span>,
    },
    {
      key: 'id' as any,
      header: '',
      render: (s) => <DeleteButton id={s.id} />,
    },
  ]

  return (
    <Table
      data={surveys}
      columns={columns}
      keyExtractor={(s) => s.id}
      emptyMessage="No survey results yet. Add your first survey."
    />
  )
}

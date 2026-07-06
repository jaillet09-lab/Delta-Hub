import { notFound } from 'next/navigation'
import { findSwms, findPolicy } from '@/lib/documents/safety'
import { SafetyPrint } from '@/components/documents/SafetyPrint'

export const dynamic = 'force-dynamic'

// Public, client-facing view of Delta's compliance library — the unsigned SWMS,
// policies, SDS register and Modern Slavery declaration. Shared with clients (in
// their portal) and subcontractors (in the onboarding pack) so they can see our
// compliance. Internal signed docs (Subcontractor Agreement, Induction) are NOT
// exposed here — those are handled by the private onboarding flow.
export default function PublicComplianceDocPage({ params }: { params: { slug: string } }) {
  const { slug } = params
  if (slug === 'modern-slavery') return <SafetyPrint viewOnly />
  if (slug === 'sds-register') return <SafetyPrint sds viewOnly />
  if (slug === 'terms-and-conditions') return <SafetyPrint terms viewOnly />
  const policy = findPolicy(slug)
  if (policy) return <SafetyPrint policy={policy} viewOnly />
  const swms = findSwms(slug)
  if (!swms) notFound()
  return <SafetyPrint swms={swms} viewOnly />
}

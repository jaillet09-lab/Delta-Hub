import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateClientAction } from '@/actions/clients'
import { ClientForm } from '@/components/clients/ClientForm'
import { Card } from '@/components/ui/Card'
import { ArrowLeft } from 'lucide-react'

export default async function EditClientPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  const [{ data: client }, admin] = await Promise.all([
    supabase.from('clients').select('*').eq('id', params.id).single(),
    Promise.resolve(createAdminClient()),
  ])

  if (!client) notFound()

  const [{ data: cleanerProfiles }, { data: existingSitesRaw }] = await Promise.all([
    (admin as any)
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'cleaner')
      .order('full_name', { ascending: true }),
    (supabase as any)
      .from('client_sites')
      .select('*')
      .eq('client_id', params.id)
      .order('sort_order', { ascending: true }),
  ])

  const cleaners = (cleanerProfiles ?? []).map((p: any) => ({
    id: p.id,
    fullName: p.full_name ?? 'Unknown',
  }))

  const defaultSites = (existingSitesRaw ?? []).map((s: any) => ({
    _localId:               s.id,
    dbId:                   s.id,
    site_name:              s.site_name               ?? '',
    address:                s.address                 ?? '',
    suburb:                 s.suburb                  ?? '',
    state:                  s.state                   ?? 'QLD',
    postcode:               s.postcode                ?? '',
    scope_of_work:          s.scope_of_work           ?? '',
    frequency:              s.frequency               ?? 'weekly',
    service_days:           s.service_days            ?? [],
    days_per_week:          s.days_per_week?.toString() ?? '',
    access_details:         s.access_details          ?? '',
    assigned_cleaner_id:    s.assigned_cleaner_id     ?? '',
    rate_per_visit:         s.rate_per_visit?.toString() ?? '',
    cleaner_hourly_rate:    s.cleaner_hourly_rate?.toString() ?? '',
    cleaner_hours_per_visit: s.cleaner_hours_per_visit?.toString() ?? '',
    notes:                  s.notes                   ?? '',
  }))

  async function action(formData: FormData) {
    'use server'
    // Read id from the form body rather than a captured closure variable so the
    // save doesn't depend on Next.js server-action arg encryption (deploy-safe).
    const clientId = (formData.get('__client_id') as string) || params.id
    return updateClientAction(clientId, formData)
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href={`/clients/${params.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {(client as any).business_name}
        </Link>
        <h2 className="text-xl font-bold text-gray-900">Edit Client</h2>
        <p className="text-sm text-gray-500 mt-0.5">{(client as any).ref_number}</p>
      </div>

      <Card>
        <ClientForm
          defaultValues={client as any}
          defaultSites={defaultSites.length > 0 ? defaultSites : undefined}
          action={action}
          submitLabel="Save Changes"
          cleaners={cleaners}
        />
      </Card>
    </div>
  )
}

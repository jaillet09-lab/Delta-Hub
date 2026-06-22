// Verify the address->company derivation against the real CSV
function looksLikeAddress(s) {
  if (!s || !s.includes(',')) return false
  return /^\s*\d/.test(s) || /\b\d{4,5}\b/.test(s)
}
function domainFrom(value) {
  if (!value) return null
  let h = value.trim().toLowerCase()
  const at = h.indexOf('@'); if (at >= 0) h = h.slice(at + 1)
  h = h.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  const parts = h.split('.').filter(Boolean)
  return parts.length >= 2 ? parts[0] : null
}
function companyFromDomain(sld) {
  if (!sld) return null
  return sld.length <= 4 ? sld.toUpperCase() : sld.charAt(0).toUpperCase() + sld.slice(1)
}

const cases = [
  { company: '200 East Randolph Street, Chicago, Illinois, United States, 60601', website: 'https://jll.com', email: 'robert.watson@jll.com' },
  { company: 'The University of Queensland', website: 'https://uq.edu.au', email: 'darryl.whitehead@uq.edu.au' },
  { company: 'Team Global Express', website: 'https://teamglobalexp.com', email: 'neil.butland@teamglobalexp.com' },
  { company: 'St James College, Brisbane', website: 'https://stjamescollege.qld.edu.au', email: 'gjunatas@stjamescollege.qld.edu.au' },
  { company: 'BGIS', website: 'https://bgis.com', email: 'michael.coulter@bgis.com' },
]

for (const c of cases) {
  let business = c.company
  if (looksLikeAddress(business)) {
    business = companyFromDomain(domainFrom(c.website) || domainFrom(c.email)) || business
  }
  console.log(`${c.company.slice(0, 40).padEnd(42)} -> ${business}`)
}

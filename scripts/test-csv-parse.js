// Quick smoke test for the CSV parser in src/actions/cold-leads.ts
const src = require('fs').readFileSync('src/actions/cold-leads.ts', 'utf8')
const start = src.indexOf('function detectColumn')
const end = src.indexOf('export async function importColdLeadsAction')
// Strip TypeScript annotations so plain node can eval it
const fns = src
  .slice(start, end)
  .replace(/: string\[\]\[\]/g, '')
  .replace(/: string\[\]/g, '')
  .replace(/: number/g, '')
  .replace(/: string/g, '')
eval(fns)

const csv = [
  'Company Name,Owner,Mobile Number,E-mail,City,Category',
  '"Smith, Jones & Co",Dave Smith,0412 345 678,dave@sj.com.au,Chermside,Accounting',
  'Acme Dental,,"+61 7 3000 1234",,"Brisbane City",Dental',
  ',,,,,',
  'Northside Gym,Mia Chen,0400111222,mia@nsgym.com,Stafford,Fitness',
].join('\r\n')

const rows = parseCsv(csv)
const headers = rows[0].map(h => h.trim().toLowerCase())

console.log('rows (expect 4):', rows.length)
console.log('business col (expect 0):', detectColumn(headers, ['business', 'company', 'organisation']))
console.log('phone col (expect 2):', detectColumn(headers, ['phone', 'mobile', 'number', 'tel']))
console.log('email col (expect 3):', detectColumn(headers, ['email', 'e-mail']))
console.log('quoted name (expect "Smith, Jones & Co"):', rows[1][0])
console.log('quoted phone (expect +61 7 3000 1234):', rows[2][2])

'use server'

// Xero server actions — kept for backward compat but logic now lives in
// /api/xero/approve (POST/DELETE) and /api/xero/data (GET).
// These are no longer called directly; this file is a stub.

export async function syncXeroTransactionsAction() {
  return { inserted: 0 }
}

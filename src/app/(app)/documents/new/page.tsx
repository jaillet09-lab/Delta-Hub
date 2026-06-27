import { redirect } from 'next/navigation'

// The document system is now proposal-first: new documents are created from the
// Documents list ("New proposal"), which inserts a record and opens the editor.
export default function NewDocumentRedirect() {
  redirect('/documents')
}

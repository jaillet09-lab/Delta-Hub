-- Widen the allowed compliance_documents.type values. The upload form already
-- offers police_check / white_card / qualification and we now store a company
-- Certificate of Currency, but the original CHECK only allowed sds / insurance /
-- contract / other — so those uploads failed. Align the constraint with the UI.

alter table public.compliance_documents
  drop constraint if exists compliance_documents_type_check;

alter table public.compliance_documents
  add constraint compliance_documents_type_check
  check (type = any (array[
    'sds', 'insurance', 'contract', 'certificate_of_currency',
    'police_check', 'white_card', 'qualification', 'other'
  ]));

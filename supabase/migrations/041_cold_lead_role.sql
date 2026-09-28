-- Cold-call leads: capture the contact's role/title (e.g. "Facilities Manager")
-- so imported lead lists (with name, verified email, phone, company and role)
-- carry the decision-maker's position through to the deck.
alter table public.cold_leads add column if not exists role text;

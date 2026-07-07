-- Add cleaner cost tracking to clients
alter table clients
  add column if not exists cleaner_hourly_rate numeric(10,2),
  add column if not exists cleaner_hours_per_visit numeric(5,2);

-- Email templates
create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  subject text not null,
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Email log
create table if not exists emails_sent (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  template_id uuid references email_templates(id) on delete set null,
  to_email text not null,
  to_name text,
  subject text not null,
  body text not null,
  sent_at timestamptz default now(),
  status text default 'sent'
);

-- RLS
alter table email_templates enable row level security;
alter table emails_sent enable row level security;

create policy "auth_all_email_templates" on email_templates for all to authenticated using (true) with check (true);
create policy "auth_all_emails_sent" on emails_sent for all to authenticated using (true) with check (true);

-- Seed default email templates
insert into email_templates (name, type, subject, body) values
('Proposal Follow-Up', 'proposal_followup', 'Following up — Commercial Cleaning Proposal', 'Hi {{contact_name}},

I wanted to follow up on the proposal I sent through for {{business_name}}.

I''m happy to answer any questions, walk you through the scope again, or adjust anything to better suit your needs.

The proposal is valid for 30 days from the date of issue. If you''d like to proceed, simply reply to this email and I''ll send through the formal Service Agreement.

Looking forward to hearing from you.

Warm regards,
Jackson Jaillet
Founder & Director, Delta Cleaning
+61 412 844 238
hello@deltacleaning.com.au'),

('Agreement Follow-Up', 'agreement_followup', 'Following up — Service Agreement', 'Hi {{contact_name}},

Just checking in regarding the Service Agreement I sent through for {{business_name}}.

Once signed, we can lock in your start date and get everything organised from our end.

Please don''t hesitate to reach out if you have any questions about the terms.

Warm regards,
Jackson Jaillet
Founder & Director, Delta Cleaning
+61 412 844 238
hello@deltacleaning.com.au'),

('Onboarding Welcome', 'onboarding', 'Welcome to Delta Cleaning — {{business_name}}', 'Hi {{contact_name}},

Welcome aboard! We''re really looking forward to working with {{business_name}}.

Here''s what to expect before your first clean:
— We''ll confirm access arrangements and any site-specific requirements
— Your assigned team will complete a pre-service briefing
— Jackson will check in after your first visit to make sure everything met your expectations

If anything comes up in the meantime, don''t hesitate to reach out directly.

Warm regards,
Jackson Jaillet
Founder & Director, Delta Cleaning
+61 412 844 238
hello@deltacleaning.com.au'),

('Survey Request', 'survey', 'Quick check-in — How are we tracking?', 'Hi {{contact_name}},

I hope everything is going well at {{business_name}}.

I like to check in with all clients regularly to make sure the standard is where it should be. It only takes a minute — I''d really appreciate your honest feedback.

If there''s anything at all that could be improved, please let me know directly. I take every piece of feedback seriously.

Warm regards,
Jackson Jaillet
Founder & Director, Delta Cleaning
+61 412 844 238
hello@deltacleaning.com.au'),

('Survey Follow-Up', 'survey_followup', 'Following up on your feedback — {{business_name}}', 'Hi {{contact_name}},

Thank you for taking the time to leave feedback recently — it''s genuinely appreciated.

I wanted to follow up personally to make sure any concerns have been addressed and that the service is meeting your expectations.

If there''s anything specific you''d like me to look into, please let me know and I''ll get onto it straight away.

Warm regards,
Jackson Jaillet
Founder & Director, Delta Cleaning
+61 412 844 238
hello@deltacleaning.com.au'),

('Thank You', 'thankyou', 'Thank you — {{business_name}}', 'Hi {{contact_name}},

I just wanted to take a moment to say thank you for your continued trust in Delta Cleaning.

It''s a pleasure working with {{business_name}} and we''re committed to maintaining a high standard on every visit.

Please never hesitate to reach out if there''s anything you need.

Warm regards,
Jackson Jaillet
Founder & Director, Delta Cleaning
+61 412 844 238
hello@deltacleaning.com.au'),

('Upsell — Additional Services', 'upsell', 'Additional services available for {{business_name}}', 'Hi {{contact_name}},

I hope things are going well.

I wanted to reach out because we''ve recently had a few clients take advantage of our specialist services — and I think they could add real value for {{business_name}} too.

We currently offer:
— Pressure washing (external surfaces, car parks, pathways)
— Carpet extraction (hot water extraction, stain treatment)
— Window washing (internal and external, frames and sills)
— Deep vinyl cleaning (machine scrub, strip and reseal)
— Female hygiene bin supply & servicing

All of these can be added to your existing schedule or done as a one-off. Happy to put together a quick quote if any of these are of interest.

Warm regards,
Jackson Jaillet
Founder & Director, Delta Cleaning
+61 412 844 238
hello@deltacleaning.com.au');

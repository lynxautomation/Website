-- ============================================
-- LYNX KUNDENPORTAL – Setup für die customers-Tabelle
-- Einmal komplett in Supabase → SQL Editor → New Query einfügen und "Run" klicken
-- ============================================

-- 1. Tabelle anlegen
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) unique not null,
  kundennummer text unique not null,
  firma text not null,
  domain text,
  website boolean default false,
  hosting boolean default false,
  chatbot boolean default false,
  seo boolean default false,
  digitale_ordnung boolean default false,
  created_at timestamptz default now()
);

-- 2. Row Level Security aktivieren — WICHTIG, ohne das kann jeder Kunde
--    theoretisch die Daten aller anderen Kunden sehen
alter table customers enable row level security;

-- 3. Regel: Ein Kunde darf ausschließlich seinen EIGENEN Datensatz lesen
create policy "Kunden sehen nur ihren eigenen Datensatz"
  on customers for select
  using (auth.uid() = user_id);

-- 4. Testdatensatz für deinen Pilot-Account anlegen
--    (verknüpft automatisch mit der user_id von lynx.automation.solutions@gmail.com,
--    du musst also keine UUID manuell heraussuchen)
insert into customers (user_id, kundennummer, firma, domain, website, hosting, chatbot, seo, digitale_ordnung)
select id, 'LY-1001', 'Das Glanzwerk', 'dasglanzwerk.studio', true, true, true, false, true
from auth.users
where email = 'lynx.automation.solutions@gmail.com';

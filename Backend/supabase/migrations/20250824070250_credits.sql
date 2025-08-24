-- 001_create_credits_system.sql

-- 1. credits tracking table
create table if not exists public.credits (
  id uuid primary key references auth.users(id) on delete cascade,
  current_credits int not null default 4,
  last_credit_award_time timestamptz not null default now(),
  daily_credit_reset_time timestamptz not null default now()
);

-- 2. function to reset credits daily
create or replace function public.reset_daily_credits() 
returns void as $$
begin
  update public.credits
  set current_credits = 4,
      daily_credit_reset_time = now()
  where daily_credit_reset_time::date < now()::date;
end;
$$ language plpgsql;

-- 3. function to auto-create credits for new users
create or replace function public.create_credits() 
returns trigger as $$
begin
  insert into public.credits (id)
  values (new.id);
  return new;
end;
$$ language plpgsql;

-- 4. trigger to create credits entry for new users
drop trigger if exists create_credits on auth.users;
create trigger create_credits
after insert on auth.users
for each row execute procedure public.create_credits();

-- 5. schedule a daily job at midnight (requires pg_cron extension enabled)
-- to enable: 
--   create extension if not exists pg_cron;
-- then schedule:
select cron.schedule(
  'reset-credits-job',   -- job name
  '0 0 * * *',           -- every day at midnight
  $$ call public.reset_daily_credits(); $$
);

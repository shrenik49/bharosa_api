-- Migration 6: password reset tokens (only a SHA-256 hash of the emailed token is stored).

create table public.password_reset_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index password_reset_tokens_user_idx on public.password_reset_tokens(user_id);

-- =============================================================================
-- Zeitgeist · 0001 Fundament
-- Erweiterungen, privates Schema `app` für Hilfsfunktionen, Enums, Utilities.
-- Das Schema `app` wird NICHT über die REST-API exponiert.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'team_lead', 'employee');
create type public.member_status as enum ('invited', 'active', 'archived');
create type public.contract_type as enum ('minijob', 'part_time', 'full_time', 'apprentice', 'working_student');
create type public.time_event_kind as enum ('check_in', 'break_start', 'break_end', 'check_out');
create type public.time_event_source as enum (
  'app', 'terminal_qr', 'personal_qr', 'pin', 'rfid', 'nfc', 'admin', 'system_auto'
);
create type public.request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.violation_severity as enum ('info', 'warning', 'violation');
create type public.rule_scope as enum ('org', 'location', 'membership');

-- Bundesländer (ISO 3166-2:DE ohne Präfix)
create domain public.german_state as text
  check (value in ('BW','BY','BE','BB','HB','HH','HE','MV','NI','NW','RP','SL','SN','ST','SH','TH'));

-- ---------------------------------------------------------------------------
-- Utilities
-- ---------------------------------------------------------------------------
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Liest die optionale Begründung, die eine Server-Funktion für das Audit-Log setzt.
create or replace function app.current_reason()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('zeitgeist.reason', true), '');
$$;

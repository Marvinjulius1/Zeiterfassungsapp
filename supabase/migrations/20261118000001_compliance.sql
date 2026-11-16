-- =============================================================================
-- Zeitgeist · Phase 4: Compliance-Ergebnisse
-- Die Regeln selbst leben in TypeScript (src/compliance). Der Server schreibt
-- die Ergebnisse mit der service_role hierher.
-- =============================================================================

alter table public.work_days
  add column auto_break_minutes int not null default 0,
  add column evaluated_at timestamptz;

alter table public.compliance_violations
  add column message text not null default '',
  add column law text;

create index compliance_violations_open
  on public.compliance_violations (org_id, detected_at desc)
  where acknowledged_at is null;

-- Bei jeder SQL-Neuberechnung (neue Buchung) gilt der Tag als „neu zu bewerten".
-- valued_minutes behält den letzten bewerteten Stand, bis der Evaluator läuft.
create or replace function app.mark_unevaluated()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.net_minutes, new.break_minutes, new.gross_minutes)
       is distinct from (old.net_minutes, old.break_minutes, old.gross_minutes)
     and new.evaluated_at is not distinct from old.evaluated_at then
    new.evaluated_at := null;
  end if;
  return new;
end;
$$;

create trigger mark_unevaluated
  before update on public.work_days
  for each row execute function app.mark_unevaluated();

-- Teamleiter/Admins dürfen Hinweise quittieren – nur diese beiden Spalten.
revoke update on public.compliance_violations from authenticated;
grant update (acknowledged_by, acknowledged_at) on public.compliance_violations to authenticated;

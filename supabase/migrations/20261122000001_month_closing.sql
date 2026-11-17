-- =============================================================================
-- Zeitgeist · Phase 8: Monatsabschluss & Lohn-Einstellungen
-- =============================================================================

-- DATEV-Zuordnung (Berater-/Mandantennummer, Lohnarten) je Firma
alter table public.organizations
  add column payroll_settings jsonb not null default '{}';
grant update (payroll_settings) on public.organizations to authenticated;

-- ---------------------------------------------------------------------------
-- Mitarbeitende bestätigen ihren Monat (nur abgelaufene Monate)
-- ---------------------------------------------------------------------------
create or replace function public.confirm_month(p_membership_id uuid, p_month date, p_snapshot jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_mem public.memberships;
begin
  select * into v_mem from public.memberships
   where id = p_membership_id and user_id = auth.uid() and status = 'active';
  if v_mem.id is null then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if p_month <> date_trunc('month', p_month)::date then
    raise exception 'Ungültiger Monat' using errcode = 'P0001';
  end if;
  if p_month >= date_trunc('month', (now() at time zone 'Europe/Berlin'))::date then
    raise exception 'Bestätigen geht erst, wenn der Monat vorbei ist.' using errcode = 'P0001';
  end if;
  perform set_config('zeitgeist.reason', 'vom Mitarbeitenden bestätigt', true);
  insert into public.month_closings (org_id, membership_id, month, employee_confirmed_at, snapshot)
  values (v_mem.org_id, v_mem.id, p_month, now(), p_snapshot)
  on conflict (membership_id, month) do update
    set employee_confirmed_at = coalesce(public.month_closings.employee_confirmed_at, now()),
        snapshot = case when public.month_closings.locked_at is null then excluded.snapshot else public.month_closings.snapshot end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Verwaltung sperrt Monate (Snapshot wird vom Server berechnet und mitgegeben)
-- ---------------------------------------------------------------------------
create or replace function public.lock_months(p_month date, p_items jsonb)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  it jsonb;
  v_mem public.memberships;
  v_n int := 0;
begin
  if p_month >= date_trunc('month', (now() at time zone 'Europe/Berlin'))::date then
    raise exception 'Nur abgelaufene Monate können abgeschlossen werden.' using errcode = 'P0001';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into v_mem from public.memberships where id = (it ->> 'membership_id')::uuid;
    if v_mem.id is null or not app.is_org_admin(v_mem.org_id) then
      raise exception 'Keine Berechtigung' using errcode = '42501';
    end if;
    perform set_config('zeitgeist.reason', 'Monatsabschluss', true);
    insert into public.month_closings (org_id, membership_id, month, locked_at, locked_by, snapshot)
    values (v_mem.org_id, v_mem.id, p_month, now(), auth.uid(), it -> 'snapshot')
    on conflict (membership_id, month) do update
      set locked_at = now(), locked_by = auth.uid(), snapshot = excluded.snapshot
      where public.month_closings.locked_at is null;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

create or replace function public.unlock_month(p_membership_id uuid, p_month date, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_mem public.memberships;
begin
  select * into v_mem from public.memberships where id = p_membership_id;
  if v_mem.id is null or not app.is_org_admin(v_mem.org_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Bitte gib eine Begründung an.' using errcode = 'P0001';
  end if;
  perform set_config('zeitgeist.reason', trim(p_reason), true);
  update public.month_closings set locked_at = null, locked_by = null
   where membership_id = p_membership_id and month = p_month and locked_at is not null;
  if not found then
    raise exception 'Dieser Monat ist nicht gesperrt.' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.confirm_month, public.lock_months, public.unlock_month from public, anon;
grant execute on function public.confirm_month, public.lock_months, public.unlock_month to authenticated;

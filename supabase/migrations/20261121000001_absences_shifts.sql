-- =============================================================================
-- Zeitgeist · Phase 7: Abwesenheiten & Schichtplanung
-- Mehrstufige Abläufe (Antrag → Zustimmung → Freigabe) laufen über Funktionen,
-- damit kein Schritt übersprungen werden kann. Audit schreibt der Trigger.
-- =============================================================================

-- Mitarbeitende dürfen ihre eigenen Abwesenheiten über request_absence anlegen
-- (direkter INSERT bleibt für Teamleiter/Admins, z. B. „krank gemeldet per Telefon")

-- ---------------------------------------------------------------------------
-- Abwesenheit beantragen / melden
-- ---------------------------------------------------------------------------
create or replace function public.request_absence(
  p_membership_id uuid,
  p_type_key      text,
  p_start         date,
  p_end           date,
  p_half_start    boolean default false,
  p_half_end      boolean default false,
  p_note          text default null,
  p_attachment    text default null
)
returns public.absences
language plpgsql security definer set search_path = ''
as $$
declare
  v_mem public.memberships;
  v_type public.absence_types;
  v_row public.absences;
begin
  select * into v_mem from public.memberships
   where id = p_membership_id and user_id = auth.uid() and status = 'active';
  if v_mem.id is null then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  select * into v_type from public.absence_types where org_id = v_mem.org_id and key = p_type_key and active;
  if v_type.id is null then
    raise exception 'Unbekannte Abwesenheitsart' using errcode = 'P0001';
  end if;
  if p_end < p_start then
    raise exception 'Das Ende liegt vor dem Beginn.' using errcode = 'P0001';
  end if;
  if p_end - p_start > 366 then
    raise exception 'Bitte höchstens ein Jahr am Stück eintragen.' using errcode = 'P0001';
  end if;
  if p_type_key = 'vacation' and p_start < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'Urlaub kann nicht rückwirkend beantragt werden.' using errcode = 'P0001';
  end if;
  if p_attachment is not null and p_attachment not like v_mem.org_id || '/' || v_mem.id || '/%' then
    raise exception 'Ungültiger Anhang' using errcode = '42501';
  end if;
  if exists (select 1 from public.absences
              where membership_id = p_membership_id and status in ('pending', 'approved')
                and start_date <= p_end and end_date >= p_start) then
    raise exception 'In diesem Zeitraum ist bereits eine Abwesenheit eingetragen.' using errcode = 'P0001';
  end if;

  insert into public.absences (org_id, membership_id, type_id, start_date, end_date, half_day_start, half_day_end,
                               status, note, attachment_path, reviewed_at)
  values (v_mem.org_id, p_membership_id, v_type.id, p_start, p_end, p_half_start, p_half_end,
          case when v_type.requires_approval then 'pending' else 'approved' end::public.request_status,
          nullif(trim(p_note), ''), p_attachment,
          case when v_type.requires_approval then null else now() end)
  returning * into v_row;

  if p_attachment is not null then
    insert into public.documents (org_id, membership_id, category, title, storage_path, uploaded_by)
    values (v_mem.org_id, p_membership_id, 'sick_note',
            'AU ' || to_char(p_start, 'DD.MM.YYYY') || '–' || to_char(p_end, 'DD.MM.YYYY'), p_attachment, auth.uid())
    on conflict (storage_path) do nothing;
  end if;
  return v_row;
end;
$$;

-- Eigenen Antrag zurückziehen (offen oder genehmigt, aber noch nicht begonnen)
create or replace function public.cancel_absence(p_absence uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_abs public.absences;
begin
  select a.* into v_abs from public.absences a
    join public.memberships m on m.id = a.membership_id
   where a.id = p_absence and m.user_id = auth.uid();
  if v_abs.id is null then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if v_abs.status not in ('pending', 'approved') then
    raise exception 'Dieser Antrag ist bereits abgeschlossen.' using errcode = 'P0001';
  end if;
  if v_abs.status = 'approved' and v_abs.start_date <= (now() at time zone 'Europe/Berlin')::date then
    raise exception 'Begonnene Abwesenheiten kann nur die Verwaltung ändern.' using errcode = 'P0001';
  end if;
  perform set_config('zeitgeist.reason', 'vom Mitarbeitenden zurückgezogen', true);
  update public.absences set status = 'cancelled' where id = p_absence;
end;
$$;

-- ---------------------------------------------------------------------------
-- Kolleg:innen (minimal: Name, Standort, Team) – für Schichttausch & Kalender
-- ---------------------------------------------------------------------------
create or replace function public.list_colleagues(p_org uuid)
returns table (id uuid, display_name text, location_id uuid, team_id uuid)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.display_name, m.location_id, m.team_id
    from public.memberships m
   where m.org_id = p_org and m.status = 'active' and app.is_member(p_org)
   order by m.display_name;
$$;

-- ---------------------------------------------------------------------------
-- Schichtbörse: offene Schicht beanspruchen
-- ---------------------------------------------------------------------------
create or replace function public.claim_open_shift(p_shift uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_shift public.shifts;
  v_mid uuid;
begin
  select * into v_shift from public.shifts where id = p_shift;
  if v_shift.id is null or v_shift.membership_id is not null or v_shift.status <> 'published' then
    raise exception 'Diese Schicht ist nicht mehr frei.' using errcode = 'P0001';
  end if;
  if v_shift.starts_at <= now() then
    raise exception 'Diese Schicht hat schon begonnen.' using errcode = 'P0001';
  end if;
  select id into v_mid from public.memberships
   where org_id = v_shift.org_id and user_id = auth.uid() and status = 'active';
  if v_mid is null then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  insert into public.shift_claims (org_id, shift_id, membership_id) values (v_shift.org_id, p_shift, v_mid)
  on conflict (shift_id, membership_id) do update set status = 'pending', decided_by = null, decided_at = null
  where public.shift_claims.status <> 'pending';
end;
$$;

create or replace function public.review_shift_claim(p_claim uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_claim public.shift_claims;
  v_shift public.shifts;
  v_user uuid;
begin
  select * into v_claim from public.shift_claims where id = p_claim for update;
  if v_claim.id is null or not app.can_manage_member(v_claim.membership_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if v_claim.status <> 'pending' then
    raise exception 'Diese Anfrage wurde bereits bearbeitet.' using errcode = 'P0001';
  end if;
  select * into v_shift from public.shifts where id = v_claim.shift_id for update;

  if p_approve then
    if v_shift.membership_id is not null then
      raise exception 'Die Schicht ist bereits vergeben.' using errcode = 'P0001';
    end if;
    update public.shifts set membership_id = v_claim.membership_id where id = v_shift.id;
    update public.shift_claims set status = 'rejected', decided_by = auth.uid(), decided_at = now()
     where shift_id = v_shift.id and id <> p_claim and status = 'pending';
  end if;
  update public.shift_claims
     set status = case when p_approve then 'approved' else 'rejected' end::public.request_status,
         decided_by = auth.uid(), decided_at = now()
   where id = p_claim;

  select user_id into v_user from public.memberships where id = v_claim.membership_id;
  if v_user is not null then
    insert into public.notifications (user_id, org_id, kind, title, body, payload)
    values (v_user, v_claim.org_id, 'shift_claim_' || case when p_approve then 'approved' else 'rejected' end,
            case when p_approve then 'Schicht übernommen ✓' else 'Schicht ging an jemand anderen' end,
            to_char(v_shift.starts_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') || '–' ||
            to_char(v_shift.ends_at at time zone 'Europe/Berlin', 'HH24:MI'),
            jsonb_build_object('shift_id', v_shift.id));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schichttausch: anfragen → Kolleg:in stimmt zu → Leitung gibt frei
-- ---------------------------------------------------------------------------
create or replace function public.request_shift_swap(p_shift uuid, p_target uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_shift public.shifts;
  v_target public.memberships;
  v_user uuid;
begin
  select s.* into v_shift from public.shifts s
    join public.memberships m on m.id = s.membership_id
   where s.id = p_shift and m.user_id = auth.uid();
  if v_shift.id is null then
    raise exception 'Das ist nicht deine Schicht.' using errcode = '42501';
  end if;
  if v_shift.status <> 'published' or v_shift.starts_at <= now() then
    raise exception 'Diese Schicht kann nicht mehr getauscht werden.' using errcode = 'P0001';
  end if;
  select * into v_target from public.memberships where id = p_target and org_id = v_shift.org_id and status = 'active';
  if v_target.id is null or v_target.id = v_shift.membership_id then
    raise exception 'Ungültige Person' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.shift_swap_requests where shift_id = p_shift and status = 'pending') then
    raise exception 'Für diese Schicht läuft bereits eine Tauschanfrage.' using errcode = 'P0001';
  end if;
  insert into public.shift_swap_requests (org_id, shift_id, requester_id, target_membership_id)
  values (v_shift.org_id, p_shift, v_shift.membership_id, p_target);

  if v_target.user_id is not null then
    insert into public.notifications (user_id, org_id, kind, title, body, payload)
    values (v_target.user_id, v_shift.org_id, 'shift_swap_request', 'Tauschanfrage für eine Schicht',
            to_char(v_shift.starts_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI') || '–' ||
            to_char(v_shift.ends_at at time zone 'Europe/Berlin', 'HH24:MI'),
            jsonb_build_object('shift_id', v_shift.id));
  end if;
end;
$$;

create or replace function public.respond_shift_swap(p_request uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_req public.shift_swap_requests;
begin
  select r.* into v_req from public.shift_swap_requests r
    join public.memberships m on m.id = r.target_membership_id
   where r.id = p_request and m.user_id = auth.uid() for update;
  if v_req.id is null then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if v_req.status <> 'pending' or v_req.target_accepted_at is not null then
    raise exception 'Diese Anfrage ist bereits beantwortet.' using errcode = 'P0001';
  end if;
  if p_accept then
    update public.shift_swap_requests set target_accepted_at = now() where id = p_request;
  else
    update public.shift_swap_requests set status = 'rejected', decided_at = now() where id = p_request;
  end if;
end;
$$;

create or replace function public.review_shift_swap(p_request uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_req public.shift_swap_requests;
  v_shift public.shifts;
  v_u1 uuid;
  v_u2 uuid;
begin
  select * into v_req from public.shift_swap_requests where id = p_request for update;
  if v_req.id is null or not app.can_manage_member(v_req.requester_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if v_req.status <> 'pending' or v_req.target_accepted_at is null then
    raise exception 'Die Kolleg:in hat noch nicht zugestimmt.' using errcode = 'P0001';
  end if;
  select * into v_shift from public.shifts where id = v_req.shift_id for update;
  if p_approve then
    update public.shifts set membership_id = v_req.target_membership_id where id = v_shift.id;
    if v_req.offered_shift_id is not null then
      update public.shifts set membership_id = v_req.requester_id where id = v_req.offered_shift_id;
    end if;
  end if;
  update public.shift_swap_requests
     set status = case when p_approve then 'approved' else 'rejected' end::public.request_status,
         decided_by = auth.uid(), decided_at = now()
   where id = p_request;

  select user_id into v_u1 from public.memberships where id = v_req.requester_id;
  select user_id into v_u2 from public.memberships where id = v_req.target_membership_id;
  insert into public.notifications (user_id, org_id, kind, title, body, payload)
  select u, v_req.org_id, 'shift_swap_' || case when p_approve then 'approved' else 'rejected' end,
         case when p_approve then 'Schichttausch genehmigt ✓' else 'Schichttausch abgelehnt' end,
         to_char(v_shift.starts_at at time zone 'Europe/Berlin', 'DD.MM. HH24:MI'),
         jsonb_build_object('shift_id', v_shift.id)
    from unnest(array[v_u1, v_u2]) u where u is not null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Wochenplan veröffentlichen (Entwürfe → sichtbar) + Benachrichtigung
-- ---------------------------------------------------------------------------
create or replace function public.publish_shifts(p_org uuid, p_from date, p_to date, p_location uuid default null)
returns int
language plpgsql security definer set search_path = ''
as $$
declare v_n int;
begin
  if not app.has_role(p_org, '{owner,admin,team_lead}') then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  with upd as (
    update public.shifts s set status = 'published'
     where s.org_id = p_org and s.status = 'draft'
       and (s.starts_at at time zone 'Europe/Berlin')::date between p_from and p_to
       and (p_location is null or s.location_id = p_location)
       and (app.is_org_admin(p_org) or s.membership_id is null or app.can_manage_member(s.membership_id))
    returning s.membership_id
  ), notify as (
    insert into public.notifications (user_id, org_id, kind, title, body, payload)
    select distinct m.user_id, p_org, 'shifts_published', 'Neuer Schichtplan',
           'Deine Schichten ' || to_char(p_from, 'DD.MM.') || '–' || to_char(p_to, 'DD.MM.YYYY') || ' sind da.',
           jsonb_build_object('from', p_from, 'to', p_to)
      from upd join public.memberships m on m.id = upd.membership_id
     where m.user_id is not null
    returning 1
  )
  select count(*) into v_n from upd;
  return v_n;
end;
$$;

revoke execute on function public.request_absence, public.cancel_absence, public.list_colleagues,
  public.claim_open_shift, public.review_shift_claim, public.request_shift_swap, public.respond_shift_swap,
  public.review_shift_swap, public.publish_shifts from public, anon;
grant execute on function public.request_absence, public.cancel_absence, public.list_colleagues,
  public.claim_open_shift, public.review_shift_claim, public.request_shift_swap, public.respond_shift_swap,
  public.review_shift_swap, public.publish_shifts to authenticated;

-- Tauschanfragen: auch die angefragte Person darf sie sehen (bereits in swap_select),
-- Schichtbörse: eigene Claims sehen (claim_select). Teamleiter sehen Claims ihres Teams.
create policy claim_select_manager on public.shift_claims for select to authenticated
  using ((select app.has_role(org_id, '{owner,admin,team_lead}')));

-- Schichtvorlagen: Standard-Vorlagen für neue Firmen
create or replace function app.bootstrap_shift_templates()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.shift_templates (org_id, name, start_time, end_time, break_minutes) values
    (new.id, 'Früh',   '06:00', '14:30', 30),
    (new.id, 'Normal', '08:00', '16:30', 30),
    (new.id, 'Spät',   '13:30', '22:00', 30);
  return new;
end;
$$;
create trigger bootstrap_shift_templates
  after insert on public.organizations
  for each row execute function app.bootstrap_shift_templates();

-- Veröffentlichte Schichten sieht die ganze Firma (wie ein ausgehängter Dienstplan –
-- nötig für Schichttausch). Entwürfe sehen nur Planende.
drop policy shift_select on public.shifts;
create policy shift_select on public.shifts for select to authenticated
  using (
    (select app.has_role(org_id, '{owner,admin,team_lead}'))
    or (status = 'published' and (select app.is_member(org_id))));

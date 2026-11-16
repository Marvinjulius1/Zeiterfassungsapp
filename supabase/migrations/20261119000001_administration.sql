-- =============================================================================
-- Zeitgeist · Phase 5: Verwaltung
-- Alle Admin-Aktionen laufen über diese Funktionen: Berechtigung + Begründung
-- werden erzwungen, das Audit-Log schreibt der Trigger automatisch.
-- =============================================================================

-- Live-Board: Buchungen in Echtzeit (RLS gilt auch für Realtime)
alter publication supabase_realtime add table public.time_events;

-- ---------------------------------------------------------------------------
-- Hilfsfunktion: Monat gesperrt?
-- ---------------------------------------------------------------------------
create or replace function app.month_locked(p_membership uuid, p_date date)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.month_closings
     where membership_id = p_membership
       and month = date_trunc('month', p_date)::date
       and locked_at is not null);
$$;

-- ---------------------------------------------------------------------------
-- Zeiten eines Tages korrigieren (Teamleiter/Admin)
--   p_void: Buchungen, die ungültig werden (nie gelöscht)
--   p_add:  neue Buchungen [{kind, occurred_at}]
-- ---------------------------------------------------------------------------
create or replace function public.admin_correct_day(
  p_membership uuid,
  p_work_date  date,
  p_void       uuid[],
  p_add        jsonb,
  p_reason     text
)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_mem public.memberships;
  v_n int := 0;
  e jsonb;
  v_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  select * into v_mem from public.memberships where id = p_membership;
  if v_mem.id is null or not app.can_manage_member(p_membership) then
    raise exception 'Keine Berechtigung für diese Person.' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Bitte gib eine Begründung an (mind. 3 Zeichen).' using errcode = 'P0001';
  end if;
  if app.month_locked(p_membership, p_work_date) then
    if not app.is_org_admin(v_mem.org_id) then
      raise exception 'Der Monat ist abgeschlossen – nur Admins dürfen noch korrigieren.' using errcode = '42501';
    end if;
    perform set_config('zeitgeist.allow_locked', 'on', true);
  end if;
  perform set_config('zeitgeist.reason', trim(p_reason), true);

  update public.time_events
     set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
   where id = any (coalesce(p_void, '{}'))
     and membership_id = p_membership
     and voided_at is null;
  get diagnostics v_n = row_count;

  for e in select * from jsonb_array_elements(coalesce(p_add, '[]'::jsonb)) loop
    v_at := (e ->> 'occurred_at')::timestamptz;
    if (v_at at time zone 'Europe/Berlin')::date not between p_work_date and p_work_date + 1 then
      raise exception 'Die Zeit % passt nicht zum Arbeitstag %.', v_at, p_work_date using errcode = 'P0001';
    end if;
    insert into public.time_events (id, org_id, membership_id, kind, occurred_at, work_date, source, created_by, note)
    values (gen_random_uuid(), v_mem.org_id, p_membership, (e ->> 'kind')::public.time_event_kind, v_at,
            p_work_date, 'admin', auth.uid(), trim(p_reason));
    v_n := v_n + 1;
  end loop;

  perform app.recompute_work_day(p_membership, p_work_date);
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Korrekturantrag übernehmen/ablehnen (intern)
-- ---------------------------------------------------------------------------
create or replace function app.apply_correction(p_request uuid, p_reviewer uuid, p_approve boolean, p_note text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_req public.correction_requests;
  v_user uuid;
  e jsonb;
  v_reason text;
begin
  select * into v_req from public.correction_requests where id = p_request for update;
  if v_req.id is null then
    raise exception 'Antrag nicht gefunden' using errcode = 'P0001';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'Dieser Antrag wurde bereits bearbeitet.' using errcode = 'P0001';
  end if;

  if p_approve then
    v_reason := 'Korrekturantrag genehmigt: ' || v_req.reason;
    perform set_config('zeitgeist.reason', v_reason, true);
    if app.month_locked(v_req.membership_id, v_req.work_date) then
      perform set_config('zeitgeist.allow_locked', 'on', true);
    end if;

    -- „Falsche Zeit": ersten Check-in und letzten Check-out des Tages ersetzen
    if v_req.kind = 'wrong_time' then
      update public.time_events set voided_at = now(), voided_by = p_reviewer, void_reason = v_reason
       where id in (
         (select id from public.time_events where membership_id = v_req.membership_id and work_date = v_req.work_date
             and voided_at is null and kind = 'check_in' order by occurred_at limit 1),
         (select id from public.time_events where membership_id = v_req.membership_id and work_date = v_req.work_date
             and voided_at is null and kind = 'check_out' order by occurred_at desc limit 1));
    end if;

    for e in select * from jsonb_array_elements(v_req.proposed) loop
      insert into public.time_events (id, org_id, membership_id, kind, occurred_at, work_date, source, created_by, note)
      values (gen_random_uuid(), v_req.org_id, v_req.membership_id, (e ->> 'kind')::public.time_event_kind,
              (e ->> 'occurred_at')::timestamptz, v_req.work_date, 'admin', p_reviewer, v_reason);
    end loop;
    perform app.recompute_work_day(v_req.membership_id, v_req.work_date);
  end if;

  perform set_config('zeitgeist.reason', coalesce(nullif(trim(p_note), ''), case when p_approve then 'genehmigt' else 'abgelehnt' end), true);
  update public.correction_requests
     set status = case when p_approve then 'approved' else 'rejected' end::public.request_status,
         reviewed_by = p_reviewer, reviewed_at = now(), review_note = nullif(trim(p_note), '')
   where id = p_request;

  select user_id into v_user from public.memberships where id = v_req.membership_id;
  if v_user is not null and v_user is distinct from p_reviewer then
    insert into public.notifications (user_id, org_id, kind, title, body, payload)
    values (v_user, v_req.org_id, 'correction_' || case when p_approve then 'approved' else 'rejected' end,
            case when p_approve then 'Korrektur genehmigt ✓' else 'Korrektur abgelehnt' end,
            coalesce(nullif(trim(p_note), ''), to_char(v_req.work_date, 'DD.MM.YYYY')),
            jsonb_build_object('work_date', v_req.work_date, 'request_id', v_req.id));
  end if;
end;
$$;

create or replace function public.review_correction(p_request uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_req public.correction_requests;
begin
  select * into v_req from public.correction_requests where id = p_request;
  if v_req.id is null or not app.can_manage_member(v_req.membership_id) then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;
  if p_approve and app.month_locked(v_req.membership_id, v_req.work_date) and not app.is_org_admin(v_req.org_id) then
    raise exception 'Der Monat ist abgeschlossen – nur Admins dürfen noch korrigieren.' using errcode = '42501';
  end if;
  perform app.apply_correction(p_request, auth.uid(), p_approve, p_note);
end;
$$;

-- Selbstkorrektur (Firmenregel „corrections.mode = self"): nur der Server (service_role)
create or replace function public.self_apply_correction(p_request uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.apply_correction(p_request, null, true, 'Selbstkorrektur (Firmenregel)');
end;
$$;

-- ---------------------------------------------------------------------------
-- Abwesenheit genehmigen/ablehnen
-- ---------------------------------------------------------------------------
create or replace function public.review_absence(p_absence uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_abs public.absences;
  v_user uuid;
  v_label text;
begin
  select * into v_abs from public.absences where id = p_absence for update;
  if v_abs.id is null or not app.can_manage_member(v_abs.membership_id) then
    raise exception 'Keine Berechtigung.' using errcode = '42501';
  end if;
  if v_abs.status <> 'pending' then
    raise exception 'Dieser Antrag wurde bereits bearbeitet.' using errcode = 'P0001';
  end if;
  perform set_config('zeitgeist.reason', coalesce(nullif(trim(p_note), ''), case when p_approve then 'genehmigt' else 'abgelehnt' end), true);
  update public.absences
     set status = case when p_approve then 'approved' else 'rejected' end::public.request_status,
         reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(trim(p_note), '')
   where id = p_absence;

  select user_id into v_user from public.memberships where id = v_abs.membership_id;
  select label into v_label from public.absence_types where id = v_abs.type_id;
  if v_user is not null then
    insert into public.notifications (user_id, org_id, kind, title, body, payload)
    values (v_user, v_abs.org_id, 'absence_' || case when p_approve then 'approved' else 'rejected' end,
            v_label || case when p_approve then ' genehmigt ✓' else ' abgelehnt' end,
            to_char(v_abs.start_date, 'DD.MM.') || ' – ' || to_char(v_abs.end_date, 'DD.MM.YYYY'),
            jsonb_build_object('absence_id', v_abs.id));
  end if;
end;
$$;

revoke execute on function public.admin_correct_day, public.review_correction, public.review_absence from public, anon;
grant execute on function public.admin_correct_day, public.review_correction, public.review_absence to authenticated;
revoke execute on function public.self_apply_correction from public, anon, authenticated;
grant execute on function public.self_apply_correction to service_role;
revoke execute on function app.apply_correction from public, anon, authenticated;

-- Organisation: Name & Aufbewahrung dürfen Admins ändern, Slug nicht
revoke update on public.organizations from authenticated;
grant update (name, default_state, retention_months, has_works_council) on public.organizations to authenticated;

-- ---------------------------------------------------------------------------
-- Neue Einladung für eine noch nicht angenommene Mitgliedschaft
-- (alte Links werden ungültig). Gibt den Klartext-Token genau einmal zurück.
-- ---------------------------------------------------------------------------
create or replace function public.reissue_invitation(p_membership uuid)
returns table (token text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_mem public.memberships;
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_exp timestamptz := now() + interval '14 days';
begin
  select * into v_mem from public.memberships where id = p_membership;
  if v_mem.id is null or not app.is_org_admin(v_mem.org_id) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if v_mem.status <> 'invited' then
    raise exception 'Diese Person hat die Einladung bereits angenommen.' using errcode = 'P0001';
  end if;
  update public.invitations set revoked_at = now()
   where membership_id = p_membership and accepted_at is null and revoked_at is null;
  insert into public.invitations (org_id, membership_id, token_hash, created_by, expires_at)
  values (v_mem.org_id, p_membership, encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid(), v_exp);
  return query select v_token, v_exp;
end;
$$;
revoke execute on function public.reissue_invitation from public, anon;
grant execute on function public.reissue_invitation to authenticated;

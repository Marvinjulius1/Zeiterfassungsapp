-- =============================================================================
-- Zeitgeist · 0006 Zugriffskontrolle (RLS), Hilfsfunktionen, Integritäts-Trigger
--
-- Rollenmodell:
--   owner     – alles, inkl. Owner-Rechte vergeben
--   admin     – alles in der Firma außer Owner-Verwaltung
--   team_lead – sieht und bearbeitet nur das eigene Team (inkl. Unterteams)
--   employee  – sieht nur sich selbst
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen (SECURITY DEFINER, damit RLS nicht rekursiv greift)
-- ---------------------------------------------------------------------------
create or replace function app.my_membership_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.id from public.memberships m
   where m.user_id = auth.uid() and m.status = 'active';
$$;

create or replace function app.is_member(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
     where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active');
$$;

create or replace function app.has_role(p_org uuid, p_roles public.member_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
     where m.org_id = p_org and m.user_id = auth.uid()
       and m.status = 'active' and m.role = any (p_roles));
$$;

create or replace function app.is_org_admin(p_org uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.has_role(p_org, '{owner,admin}');
$$;

-- Teams, die ich leite – inklusive aller Unterteams (Organigramm)
create or replace function app.led_team_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  with recursive led as (
    select t.id from public.teams t
     where t.lead_membership_id in (select app.my_membership_ids())
    union
    select c.id from public.teams c join led on c.parent_team_id = led.id
  )
  select id from led;
$$;

-- Darf ich die Daten dieser Mitgliedschaft sehen? (selbst, Admin, Teamleiter)
create or replace function app.can_see_member(p_membership uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
     where m.id = p_membership
       and (
         m.user_id = auth.uid()
         or app.is_org_admin(m.org_id)
         or (m.team_id is not null and m.team_id in (select app.led_team_ids())
             and app.has_role(m.org_id, '{team_lead}'))
       ));
$$;

-- Darf ich für diese Mitgliedschaft Freigaben erteilen / planen? (Admin, Teamleiter – nicht selbst)
create or replace function app.can_manage_member(p_membership uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
     where m.id = p_membership
       and (
         app.is_org_admin(m.org_id)
         or (m.user_id is distinct from auth.uid()
             and m.team_id is not null and m.team_id in (select app.led_team_ids())
             and app.has_role(m.org_id, '{team_lead}'))
       ));
$$;

create or replace function app.is_own_membership(p_membership uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_membership in (select app.my_membership_ids());
$$;

grant execute on all functions in schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Integrität: org_id wird immer aus der Mitgliedschaft übernommen
-- (verhindert mandantenübergreifende Manipulation)
-- ---------------------------------------------------------------------------
create or replace function app.fill_org_from_membership()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_org uuid;
begin
  select m.org_id into v_org from public.memberships m where m.id = new.membership_id;
  if v_org is null then
    raise exception 'Unbekannte Mitgliedschaft' using errcode = '23503';
  end if;
  new.org_id := v_org;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'employment_contracts','compensations','invitations','geo_consents','time_events',
    'work_days','compliance_violations','correction_requests','time_account_adjustments',
    'month_closings','absences','vacation_entitlements','shift_claims','documents','data_requests',
    'member_credentials'
  ] loop
    execute format(
      'create trigger fill_org before insert or update of membership_id, org_id on public.%I
         for each row execute function app.fill_org_from_membership()', t);
  end loop;
end $$;

-- Owner-Rolle darf nur von Ownern vergeben/entzogen werden; niemand ändert seine eigene Rolle.
create or replace function app.guard_membership_role()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null
     or coalesce(current_setting('zeitgeist.bootstrap', true), 'off') = 'on' then
    return new; -- System / service_role / Firmengründung
  end if;
  if tg_op = 'UPDATE' and new.org_id <> old.org_id then
    raise exception 'Mitgliedschaften können nicht die Firma wechseln.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    if old.user_id = auth.uid() then
      raise exception 'Die eigene Rolle kann nicht geändert werden.' using errcode = '42501';
    end if;
    if (old.role = 'owner' or new.role = 'owner') and not app.has_role(new.org_id, '{owner}') then
      raise exception 'Nur Owner können Owner-Rechte vergeben oder entziehen.' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'INSERT' and new.role = 'owner' and not app.has_role(new.org_id, '{owner}') then
    raise exception 'Nur Owner können Owner anlegen.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_membership_role
  before insert or update on public.memberships
  for each row execute function app.guard_membership_role();

-- Jede Mitgliedschaft bekommt Stempel-Zugangsdaten (persönlicher QR etc.)
create or replace function app.create_member_credentials()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.member_credentials (membership_id, org_id)
  values (new.id, new.org_id) on conflict do nothing;
  return new;
end;
$$;

create trigger create_member_credentials
  after insert on public.memberships
  for each row execute function app.create_member_credentials();

-- Neue Firma: Standard-Regelwerk und Abwesenheitsarten
create or replace function app.bootstrap_organization()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.rule_sets (org_id, scope, scope_id, settings)
  values (new.id, 'org', new.id, '{}');

  insert into public.absence_types (org_id, key, label, counts_as_work, deducts_vacation, requires_approval, requires_document) values
    (new.id, 'vacation',   'Urlaub',               true,  true,  true,  false),
    (new.id, 'sick',       'Krank',                true,  false, false, true),
    (new.id, 'child_sick', 'Kind krank',           false, false, false, true),
    (new.id, 'school',     'Berufsschule',         true,  false, false, false),
    (new.id, 'special',    'Sonderurlaub',         true,  false, true,  false),
    (new.id, 'unpaid',     'Unbezahlter Urlaub',   false, false, true,  false),
    (new.id, 'comp_time',  'Überstundenabbau',     false, false, true,  false);
  return new;
end;
$$;

create trigger bootstrap_organization
  after insert on public.organizations
  for each row execute function app.bootstrap_organization();

-- ---------------------------------------------------------------------------
-- RLS aktivieren – überall, ausnahmslos
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Policies
-- Konvention: (select fn()) → wird pro Statement nur einmal ausgewertet.
-- ---------------------------------------------------------------------------

-- organizations
create policy org_select on public.organizations for select to authenticated
  using ((select app.is_member(id)));
create policy org_update on public.organizations for update to authenticated
  using ((select app.is_org_admin(id))) with check ((select app.is_org_admin(id)));

-- locations, teams, projects, shift_templates, absence_types: alle Mitglieder lesen, Admins schreiben
create policy loc_select on public.locations for select to authenticated using ((select app.is_member(org_id)));
create policy loc_write  on public.locations for all to authenticated
  using ((select app.is_org_admin(org_id))) with check ((select app.is_org_admin(org_id)));

create policy team_select on public.teams for select to authenticated using ((select app.is_member(org_id)));
create policy team_write  on public.teams for all to authenticated
  using ((select app.is_org_admin(org_id))) with check ((select app.is_org_admin(org_id)));

create policy proj_select on public.projects for select to authenticated using ((select app.is_member(org_id)));
create policy proj_write  on public.projects for all to authenticated
  using ((select app.is_org_admin(org_id))) with check ((select app.is_org_admin(org_id)));

create policy abst_select on public.absence_types for select to authenticated using ((select app.is_member(org_id)));
create policy abst_write  on public.absence_types for all to authenticated
  using ((select app.is_org_admin(org_id))) with check ((select app.is_org_admin(org_id)));

create policy shtpl_select on public.shift_templates for select to authenticated using ((select app.is_member(org_id)));
create policy shtpl_write  on public.shift_templates for all to authenticated
  using ((select app.has_role(org_id, '{owner,admin,team_lead}')))
  with check ((select app.has_role(org_id, '{owner,admin,team_lead}')));

-- rule_sets: alle lesen (effektive Regeln), Admins schreiben
create policy rules_select on public.rule_sets for select to authenticated using ((select app.is_member(org_id)));
create policy rules_write  on public.rule_sets for all to authenticated
  using ((select app.is_org_admin(org_id))) with check ((select app.is_org_admin(org_id)));

-- terminals: Admins
create policy term_admin on public.terminals for all to authenticated
  using ((select app.is_org_admin(org_id))) with check ((select app.is_org_admin(org_id)));

-- profiles: nur das eigene
create policy profile_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profile_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- memberships
create policy mem_select on public.memberships for select to authenticated
  using ((select app.can_see_member(id)));
create policy mem_insert on public.memberships for insert to authenticated
  with check ((select app.is_org_admin(org_id)));
create policy mem_update on public.memberships for update to authenticated
  using ((select app.is_org_admin(org_id))) with check ((select app.is_org_admin(org_id)));
-- kein DELETE: Mitgliedschaften werden archiviert

-- Verträge: sehen wie Mitglied, schreiben nur Admin
create policy contract_select on public.employment_contracts for select to authenticated
  using ((select app.can_see_member(membership_id)));
create policy contract_write on public.employment_contracts for all to authenticated
  using ((select app.is_org_admin(org_id))) with check ((select app.is_org_admin(org_id)));

-- Vergütung: nur selbst + Admin
create policy comp_select on public.compensations for select to authenticated
  using ((select app.is_own_membership(membership_id)) or (select app.is_org_admin(org_id)));
create policy comp_write on public.compensations for all to authenticated
  using ((select app.is_org_admin(org_id))) with check ((select app.is_org_admin(org_id)));

-- Einladungen: Admins
create policy inv_admin on public.invitations for all to authenticated
  using ((select app.is_org_admin(org_id))) with check ((select app.is_org_admin(org_id)));

-- Geo-Einwilligung: selbst erteilen/widerrufen, Admin lesen
create policy geo_select on public.geo_consents for select to authenticated
  using ((select app.is_own_membership(membership_id)) or (select app.is_org_admin(org_id)));
create policy geo_insert on public.geo_consents for insert to authenticated
  with check ((select app.is_own_membership(membership_id)) and revoked_at is null);
create policy geo_update on public.geo_consents for update to authenticated
  using ((select app.is_own_membership(membership_id)))
  with check ((select app.is_own_membership(membership_id)));

-- Zeitbuchungen: lesen wie Mitglied. Schreiben ausschließlich über Server-Funktionen.
create policy te_select on public.time_events for select to authenticated
  using ((select app.can_see_member(membership_id)));

create policy wd_select on public.work_days for select to authenticated
  using ((select app.can_see_member(membership_id)));

create policy cv_select on public.compliance_violations for select to authenticated
  using ((select app.can_see_member(membership_id)));
create policy cv_ack on public.compliance_violations for update to authenticated
  using ((select app.can_manage_member(membership_id)))
  with check ((select app.can_manage_member(membership_id)));

-- Korrekturanträge: selbst stellen (nur pending), Teamleiter/Admin entscheiden
create policy cr_select on public.correction_requests for select to authenticated
  using ((select app.can_see_member(membership_id)));
create policy cr_insert on public.correction_requests for insert to authenticated
  with check ((select app.is_own_membership(membership_id)) and status = 'pending'
              and reviewed_by is null and reviewed_at is null);
create policy cr_update on public.correction_requests for update to authenticated
  using ((select app.can_manage_member(membership_id)))
  with check ((select app.can_manage_member(membership_id)));

create policy taa_select on public.time_account_adjustments for select to authenticated
  using ((select app.can_see_member(membership_id)));
create policy taa_insert on public.time_account_adjustments for insert to authenticated
  with check ((select app.is_org_admin(org_id)));

create policy mc_select on public.month_closings for select to authenticated
  using ((select app.can_see_member(membership_id)));

-- Abwesenheiten
create policy abs_select on public.absences for select to authenticated
  using ((select app.can_see_member(membership_id)));
create policy abs_insert on public.absences for insert to authenticated
  with check (
    ((select app.is_own_membership(membership_id)) and status = 'pending' and reviewed_by is null)
    or (select app.can_manage_member(membership_id)));
create policy abs_update on public.absences for update to authenticated
  using ((select app.can_manage_member(membership_id)))
  with check ((select app.can_manage_member(membership_id)));

create policy vac_select on public.vacation_entitlements for select to authenticated
  using ((select app.can_see_member(membership_id)));
create policy vac_write on public.vacation_entitlements for all to authenticated
  using ((select app.is_org_admin(org_id))) with check ((select app.is_org_admin(org_id)));

-- Schichten: eigene, offene (veröffentlichte) und – als Planer – die des Teams
create policy shift_select on public.shifts for select to authenticated
  using (
    (membership_id is not null and (select app.can_see_member(membership_id)))
    or (membership_id is null and status = 'published' and (select app.is_member(org_id)))
    or (select app.has_role(org_id, '{owner,admin,team_lead}')));
create policy shift_write on public.shifts for all to authenticated
  using ((select app.is_org_admin(org_id))
         or (membership_id is not null and (select app.can_manage_member(membership_id)))
         or (membership_id is null and (select app.has_role(org_id, '{team_lead}'))))
  with check ((select app.is_org_admin(org_id))
         or (membership_id is not null and (select app.can_manage_member(membership_id)))
         or (membership_id is null and (select app.has_role(org_id, '{team_lead}'))));

create policy swap_select on public.shift_swap_requests for select to authenticated
  using ((select app.can_see_member(requester_id))
         or (target_membership_id is not null and (select app.is_own_membership(target_membership_id))));
create policy swap_insert on public.shift_swap_requests for insert to authenticated
  with check ((select app.is_own_membership(requester_id)) and status = 'pending');

create policy claim_select on public.shift_claims for select to authenticated
  using ((select app.can_see_member(membership_id)));
create policy claim_insert on public.shift_claims for insert to authenticated
  with check ((select app.is_own_membership(membership_id)) and status = 'pending');

-- Personalakte: selbst + Admin (Teamleiter bewusst NICHT)
create policy doc_select on public.documents for select to authenticated
  using ((select app.is_own_membership(membership_id)) or (select app.is_org_admin(org_id)));
create policy doc_insert on public.documents for insert to authenticated
  with check ((select app.is_org_admin(org_id))
              or ((select app.is_own_membership(membership_id)) and category = 'sick_note'));
create policy doc_update on public.documents for update to authenticated
  using ((select app.is_org_admin(org_id))) with check ((select app.is_org_admin(org_id)));

-- Benachrichtigungen & Push: nur eigene
create policy notif_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notif_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_all on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- DSGVO-Anfragen
create policy dr_select on public.data_requests for select to authenticated
  using ((select app.is_own_membership(membership_id)) or (select app.is_org_admin(org_id)));
create policy dr_insert on public.data_requests for insert to authenticated
  with check ((select app.is_own_membership(membership_id)) and status = 'pending');

-- Audit-Log: nur lesen, nur Admins. Schreiben ausschließlich per Trigger.
create policy audit_select on public.audit_log for select to authenticated
  using ((select app.is_org_admin(org_id)));

-- member_credentials, terminal_secrets: RLS aktiv, KEINE Policy → für Clients unsichtbar.

-- ---------------------------------------------------------------------------
-- Tabellenrechte: anon bekommt nichts, authenticated das Nötige
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on public.member_credentials, public.terminal_secrets from authenticated;
revoke insert, update, delete on public.audit_log from authenticated;
revoke insert, update, delete on public.time_events, public.work_days, public.month_closings from authenticated;

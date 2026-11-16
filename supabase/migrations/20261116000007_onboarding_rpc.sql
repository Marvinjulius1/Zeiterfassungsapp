-- =============================================================================
-- Zeitgeist · 0007 Onboarding & Einladungen (RPC) + Storage
-- =============================================================================

create or replace function app.slugify(p text)
returns text
language sql immutable set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    replace(replace(replace(replace(lower(p), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'),
    '[^a-z0-9]+', '-', 'g'));
$$;

-- ---------------------------------------------------------------------------
-- Firma gründen: Firma + erster Standort + Owner-Mitgliedschaft in einem Schritt
-- ---------------------------------------------------------------------------
create or replace function public.create_organization(
  p_name          text,
  p_state         public.german_state,
  p_location_name text,
  p_display_name  text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_loc uuid;
  v_slug text;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;

  v_slug := left(app.slugify(p_name), 50) || '-' || encode(extensions.gen_random_bytes(2), 'hex');
  perform set_config('zeitgeist.bootstrap', 'on', true);

  insert into public.organizations (name, slug, default_state)
  values (trim(p_name), v_slug, p_state)
  returning id into v_org;

  insert into public.locations (org_id, name, state)
  values (v_org, coalesce(nullif(trim(p_location_name), ''), 'Hauptsitz'), p_state)
  returning id into v_loc;

  insert into public.memberships (org_id, user_id, role, status, display_name, email, location_id)
  select v_org, v_uid, 'owner', 'active', trim(p_display_name), u.email, v_loc
    from auth.users u where u.id = v_uid;

  update public.profiles set full_name = trim(p_display_name)
   where id = v_uid and (full_name = '' or full_name is null);

  perform set_config('zeitgeist.bootstrap', 'off', true);
  return v_org;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mitarbeiter einladen: legt Mitgliedschaft (invited) + Einladung an.
-- Gibt den Klartext-Token GENAU EINMAL zurück; gespeichert wird nur der Hash.
-- ---------------------------------------------------------------------------
create or replace function public.invite_member(
  p_org          uuid,
  p_display_name text,
  p_email        text default null,
  p_role         public.member_role default 'employee',
  p_location_id  uuid default null,
  p_team_id      uuid default null
)
returns table (membership_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_mid uuid;
  v_exp timestamptz := now() + interval '14 days';
begin
  if not app.is_org_admin(p_org) then
    raise exception 'Keine Berechtigung' using errcode = '42501';
  end if;
  if p_role = 'owner' and not app.has_role(p_org, '{owner}') then
    raise exception 'Nur Owner können Owner einladen.' using errcode = '42501';
  end if;

  insert into public.memberships (org_id, role, status, display_name, email, location_id, team_id)
  values (p_org, p_role, 'invited', trim(p_display_name), nullif(lower(trim(p_email)), ''), p_location_id, p_team_id)
  returning id into v_mid;

  insert into public.invitations (org_id, membership_id, token_hash, created_by, expires_at)
  values (p_org, v_mid, encode(extensions.digest(v_token, 'sha256'), 'hex'), auth.uid(), v_exp);

  return query select v_mid, v_token, v_exp;
end;
$$;

-- Vorschau für die Einladungsseite (auch ohne Login aufrufbar)
create or replace function public.get_invitation_preview(p_token text)
returns table (org_name text, display_name text, email text, is_valid boolean)
language sql stable security definer set search_path = ''
as $$
  select o.name, m.display_name,
         -- E-Mail nur maskiert zurückgeben
         case when m.email is null then null
              else left(m.email, 2) || '•••@' || split_part(m.email, '@', 2) end,
         (i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
    from public.invitations i
    join public.memberships m on m.id = i.membership_id
    join public.organizations o on o.id = i.org_id
   where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_inv public.invitations;
  v_mem public.memberships;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;

  select * into v_inv from public.invitations
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
   for update;

  if v_inv.id is null or v_inv.accepted_at is not null or v_inv.revoked_at is not null
     or v_inv.expires_at <= now() then
    raise exception 'Diese Einladung ist nicht mehr gültig.' using errcode = 'P0001';
  end if;

  select * into v_mem from public.memberships where id = v_inv.membership_id for update;
  select lower(email) into v_email from auth.users where id = v_uid;

  if v_mem.email is not null and v_mem.email <> v_email then
    raise exception 'Diese Einladung gilt für eine andere E-Mail-Adresse.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.memberships where org_id = v_inv.org_id and user_id = v_uid) then
    raise exception 'Du bist bereits Mitglied dieser Firma.' using errcode = 'P0001';
  end if;

  update public.memberships
     set user_id = v_uid, status = 'active', email = coalesce(email, v_email)
   where id = v_mem.id;

  update public.invitations set accepted_at = now() where id = v_inv.id;

  update public.profiles set full_name = v_mem.display_name
   where id = v_uid and (full_name = '' or full_name = split_part(v_email, '@', 1));

  return v_inv.org_id;
end;
$$;

revoke execute on function public.create_organization, public.invite_member, public.accept_invitation from public, anon;
grant execute on function public.create_organization, public.invite_member, public.accept_invitation to authenticated;
grant execute on function public.get_invitation_preview to anon, authenticated;
revoke execute on function public.verify_audit_chain from public, anon;
grant execute on function public.verify_audit_chain to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private Buckets, Pfad = <org_id>/<membership_id>/<datei>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  ('avatars',   'avatars',   false, 2097152,  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "documents: lesen selbst/admin" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (
    app.is_org_admin(((storage.foldername(name))[1])::uuid)
    or app.is_own_membership(((storage.foldername(name))[2])::uuid)));

create policy "documents: hochladen selbst/admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (
    app.is_org_admin(((storage.foldername(name))[1])::uuid)
    or app.is_own_membership(((storage.foldername(name))[2])::uuid)));

create policy "avatars: selbst lesen" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: selbst schreiben" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: selbst ändern" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

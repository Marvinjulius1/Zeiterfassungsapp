-- =============================================================================
-- Zeitgeist · Phase 9: Benachrichtigungen (Glocke + Push)
-- =============================================================================

-- Push-Versand merkt sich, was schon verschickt wurde (auch ohne Abo → kein erneuter Versuch)
alter table public.notifications add column pushed_at timestamptz;
create index notifications_push_pending on public.notifications (created_at) where pushed_at is null;

-- Nutzer dürfen nur "gelesen" setzen – Titel, Text, Empfänger bleiben unveränderlich
revoke update, insert, delete on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

-- Alle eigenen als gelesen markieren
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int
language sql security invoker set search_path = ''
as $$
  with u as (
    update public.notifications set read_at = now()
     where user_id = (select auth.uid()) and read_at is null
       and (p_ids is null or id = any (p_ids))
    returning 1)
  select count(*)::int from u;
$$;
revoke execute on function public.mark_notifications_read from public, anon;
grant execute on function public.mark_notifications_read to authenticated;

-- Push-Abos: eigenes Gerät an-/abmelden (Endpoint ist global eindeutig → bei
-- Kontowechsel auf demselben Gerät übernimmt der neue Nutzer das Abo)
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet' using errcode = '42501';
  end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 then
    raise exception 'Ungültiges Push-Abo' using errcode = 'P0001';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;
revoke execute on function public.save_push_subscription from public, anon;
grant execute on function public.save_push_subscription to authenticated;

-- Glocke aktualisiert sich live (RLS gilt auch für Realtime)
alter publication supabase_realtime add table public.notifications;

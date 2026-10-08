-- Member events carry their member (new look, Phase 8; PHASE-8.md §9 D2).
--
-- usageStore.record inserts from the browser under the member's session,
-- and member_insert_usage_events (0026) already limits user_id to null or
-- auth.uid(). But the fill page's opens, exports and LinkedIn posts were
-- recorded with user_id null, so Insights' Active members counted only bulk
-- fills and a member filter had nothing to filter: on prod, 0 of 210 events
-- in the 90 days to 2026-10-06 carried a member.
--
-- The fix is here rather than at the call sites, so no present or future
-- caller can forget it: a member row inserted without a user takes the
-- inserting session's user. Public-link rows (actor = 'public') are written
-- by Edge Functions under the service key, where auth.uid() is null, and
-- stay unattributed as 0026 intends; an Edge Function that ever logs a
-- member event passes the user explicitly for the same reason.
--
-- History is not backfilled: there is nothing to backfill it from.

create function usage_events_attribute_member() returns trigger
  language plpgsql security invoker set search_path = public as $$
begin
  if new.actor = 'member' and new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end
$$;

create trigger usage_events_attribute_member
  before insert on usage_events
  for each row execute function usage_events_attribute_member();

-- Onboarding's answers (new look, Phase 8b; PHASE-8B.md §9 D11).
--
-- The Create account flow (Figma 257:2) asks who the person is and what
-- the workspace is for. Nothing changes behaviour on these answers yet: they
-- are kept so the product can use them later.
--
--  - users.job_role: the role tile chosen on "Let's get to know you"
--    (marketing, design, founder, people, events, sales, agency, other).
--    The person's name already lives in users.name.
--  - companies.profile: the workspace's answers, as one object:
--      setup_for   company | clients | locations | just_me
--      heard_from  where they heard about SocialPaint
--      team_size   just_me | 2_10 | 11_50 | 51_200 | 201_plus
--      makers      who will make graphics (a list)
--      first_up    what they want to make first (a list)
--      platforms   where they post the most (a list)
--
-- No new policies: self_update_users (0006) lets a person write their own
-- row, and admin_update_companies (0006) lets the workspace's admins write
-- its profile; onboarding writes it as the admin create_company_with_admin
-- just made.

alter table users add column if not exists job_role text;

alter table companies add column if not exists profile jsonb not null default '{}'::jsonb;

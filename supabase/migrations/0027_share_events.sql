-- A third kind of usage event: the person took the finished graphic to
-- LinkedIn.
--
-- Downloading and posting are different acts, and the gap between them is
-- the interesting number — an admin whose template gets exported forty times
-- and posted twice has a caption problem, not a template problem, and no
-- count that folds the two together can show that.
--
-- IMPORTANT for anyone reading the counting code: every place that tallies
-- usage_events used to branch `if open … else download`, which would have
-- quietly reported every share as a download. All four were rewritten to
-- name the action explicitly in the same change that added this value. A
-- fifth action must do the same.
--
-- `ALTER TYPE … ADD VALUE` is deliberately the ONLY statement here. Postgres
-- will not let a new enum value be USED in the transaction that creates it,
-- so anything referencing 'share' has to land in a later migration.

alter type usage_action add value if not exists 'share';

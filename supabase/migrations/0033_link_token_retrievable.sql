-- Retrievable link URLs (2026-09-15, at CJ's direction): Insights grows a
-- public-links card with copy-to-clipboard, so the plaintext token is now
-- STORED beside its hash for links minted or regenerated from here on.
--
-- This deliberately amends 0026's security argument, which promised "this
-- database does not contain a working key to any customer's template".
-- After this migration it can. What does NOT change:
--
--   * The gate still verifies against token_hash only — public_link_lookup
--     is untouched, and nothing anonymous reads this column.
--   * RLS is untouched: admin_read_template_links still restricts every
--     row to the company's admins, and anon/authenticated table-level
--     SELECT stays revoked.
--   * Links minted before this migration have no stored plaintext (NULL)
--     and stay unrecoverable — regenerate remains their recovery path.
--
-- The trade CJ accepted: a compromised admin session (or database dump)
-- can now read the live share URLs of that company's templates, in
-- exchange for "copy the link again later" working in the product.
alter table template_links add column token text;

-- The 0026 grant is per-column (table-level SELECT stays revoked), so the
-- new column needs naming for the admin UI to read it back. Row access is
-- still admin_read_template_links.
grant select (token) on template_links to authenticated;

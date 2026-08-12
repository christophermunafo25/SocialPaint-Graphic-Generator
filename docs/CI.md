# CI and branch protection

Every pull request and every push to `main` runs `.github/workflows/ci.yml`:
install with a frozen lockfile, app typecheck (`tsc`), edge-function typecheck
(`deno check`), lint, format check, tests, and a production build (which runs
the `scripts/check-production-env.mjs` configuration guard). Any failing step
fails the run. The same pipeline runs locally as one command:

```bash
npm run verify
```

Requires Node 26 and Deno 2.x (`brew install deno`).

## Build-guard variables (optional)

CI builds with correctly-shaped placeholder Supabase values — it compiles the
bundle but never deploys it (Vercel builds with its own env). To make CI
validate the real configuration instead, add repository **variables** (not
secrets — the anon key is public by design):

1. GitHub → repo → **Settings → Secrets and variables → Actions → Variables**.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same values
   Vercel uses. No workflow change needed.

## Branch protection — apply by hand in the GitHub UI

CI only gates merges once `main` requires it. Apply once, by hand (a ruleset is
the current mechanism; classic branch protection works the same way):

1. GitHub → repo → **Settings → Rules → Rulesets → New ruleset → New branch
   ruleset**.
2. **Name**: `protect-main`. **Enforcement status**: Active.
3. **Target branches**: Add target → **Include default branch**.
4. Enable **Require a pull request before merging**.
   - **Required approvals: 0** — this is a solo repo and GitHub does not let
     you approve your own PR; the required status check below is the real
     gate. Raise it if a second maintainer ever joins.
5. Enable **Require status checks to pass**.
   - Add check: **`verify`** (the job name in `ci.yml`; it appears in the
     picker after the workflow's first run on GitHub).
   - Enable **Require branches to be up to date before merging** so stale
     branches re-run CI against current `main`.
6. Enable **Block force pushes**. Leave **Restrict deletions** on (default).
7. Create the ruleset.

With this in place there are no direct pushes to `main` — all work lands via a
PR that `verify` has passed. Note for AI-assisted sessions: agents should
create a branch and open a PR rather than pushing to `main`.

## Renaming caution

The required check is matched by job name. If the `ci` job's `name: verify` in
`ci.yml` ever changes, update the ruleset's required check to match or merges
will block on a check that never reports.

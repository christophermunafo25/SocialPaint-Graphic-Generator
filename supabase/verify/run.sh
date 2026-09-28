#!/bin/bash
#
# Tenant-isolation and lifecycle verification for public template links.
#
# Runs every migration in order against a throwaway Postgres, then asserts the
# things that would be a security incident if they stopped being true: that a
# public link reaches exactly one template, that every refusal is
# indistinguishable, that no client role can read or write the link tables,
# that the use cap is claimed atomically, and that nothing is orphaned by any
# deletion.
#
# It needs a Postgres 14+ on the PATH and nothing else — no Docker, no
# Supabase CLI. The auth and storage schemas are stubbed in 00_shim.sql; the
# policies, functions, grants, and cascades under test are the real ones,
# applied from supabase/migrations.
#
# What this CANNOT cover, and what still has to be checked against a real
# project before shipping: Storage signing (there is no storage backend here),
# the deployed Edge Functions end to end, and the browser export.
#
#   ./supabase/verify/run.sh            # uses a running local Postgres
#   PGHOST=... PGPORT=... ./run.sh      # or point it at one

set -euo pipefail
cd "$(dirname "$0")"

DB="${VERIFY_DB:-socialpaint_verify}"
MIGRATIONS="../migrations"

command -v psql >/dev/null || { echo "psql not found on PATH"; exit 1; }

echo "==> Rebuilding $DB"
dropdb --if-exists "$DB"
createdb "$DB"

echo "==> Stubbing the auth and storage schemas"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f 00_shim.sql >/dev/null

echo "==> Applying migrations"
for f in "$MIGRATIONS"/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f" >/dev/null 2>&1 \
    || { echo "FAILED applying $f"; psql -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; exit 1; }
done

echo "==> Seeding two tenants"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f 10_seed.sql >/dev/null

echo "==> Checks"
# The psql exit status is what decides, so it is captured BEFORE the output
# is tidied — piping straight into sed would hand the script grep's status
# and let a failed check pass silently.
if ! psql -X -v ON_ERROR_STOP=1 -d "$DB" -f 20_checks.sql > /tmp/verify-checks.out 2>&1; then
  sed -E 's/^psql:[^:]+:[0-9]+: (NOTICE|ERROR):  /\1: /' /tmp/verify-checks.out
  echo "FAILED: a check did not pass"
  exit 1
fi
sed -E 's/^psql:[^:]+:[0-9]+: NOTICE:  //' /tmp/verify-checks.out \
  | grep -vE '^(DO|CREATE FUNCTION|SET|RESET)$'

echo "==> Settings checks"
if ! psql -X -v ON_ERROR_STOP=1 -d "$DB" -f 30_settings.sql > /tmp/verify-settings.out 2>&1; then
  sed -E 's/^psql:[^:]+:[0-9]+: (NOTICE|ERROR):  /\1: /' /tmp/verify-settings.out
  echo "FAILED: a settings check did not pass"
  exit 1
fi
sed -E 's/^psql:[^:]+:[0-9]+: NOTICE:  //' /tmp/verify-settings.out \
  | grep -vE '^(DO|CREATE FUNCTION|SET|RESET|INSERT|UPDATE|DELETE).*$'

echo "==> Canva connection checks"
if ! psql -X -v ON_ERROR_STOP=1 -d "$DB" -f 40_canva.sql > /tmp/verify-canva.out 2>&1; then
  sed -E 's/^psql:[^:]+:[0-9]+: (NOTICE|ERROR):  /\1: /' /tmp/verify-canva.out
  echo "FAILED: a Canva check did not pass"
  exit 1
fi
sed -E 's/^psql:[^:]+:[0-9]+: NOTICE:  //' /tmp/verify-canva.out \
  | grep -vE '^(DO|CREATE FUNCTION|SET|RESET|INSERT|UPDATE|DELETE).*$'

echo "==> Generate chat checks"
if ! psql -X -v ON_ERROR_STOP=1 -d "$DB" -f 50_generate_threads.sql > /tmp/verify-generate.out 2>&1; then
  sed -E 's/^psql:[^:]+:[0-9]+: (NOTICE|ERROR):  /\1: /' /tmp/verify-generate.out
  echo "FAILED: a Generate chat check did not pass"
  exit 1
fi
sed -E 's/^psql:[^:]+:[0-9]+: NOTICE:  //' /tmp/verify-generate.out \
  | grep -vE '^(DO|CREATE FUNCTION|SET|RESET|INSERT|UPDATE|DELETE|BEGIN|ROLLBACK).*$'

echo "==> Storage references stay in their company's folder"
# The read-only audit that can also run against production, run here over
# seeded rows: it must flag exactly the references A's rows plant in B's
# folder, and none of the legitimate ones.
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f 60_storage_refs.sql >/dev/null
A=ca600000-0000-4000-8000-00000000000a
B=cb600000-0000-4000-8000-00000000000b
actual=$(psql -X -tA -v ON_ERROR_STOP=1 -d "$DB" -f storage_ref_audit.sql \
  | cut -d'|' -f3- | LC_ALL=C sort)
expected=$(LC_ALL=C sort <<EOF
background|template-backgrounds/$B/1727500000000-bg.png
image logo|brand-assets/$A/logo/../../$B/logo/1727500000000-logo.png
image photo|brand-assets/$B/image/1727500000000-photo.png
mask photo|template-backgrounds/$B/masks/1727500000000-0.png
variation background|template-backgrounds/$B/1727500000000-bg-dark.png
variation image logo|brand-assets/$B/logo/1727500000000-logo.png
font Borrowed.woff2|$B/font/1727500000000-Borrowed.woff2
EOF
)
if [ "$actual" = "$expected" ]; then
  echo "pass  the audit flags every planted foreign reference and nothing legitimate"
else
  echo "FAIL: the storage reference audit disagrees with the seeded rows"
  diff <(echo "$expected") <(echo "$actual") || true
  exit 1
fi

echo "==> Concurrency: two visitors, one remaining use"
psql -q -d "$DB" -c "
  update template_links set use_count = 0, use_cap = 1, revoked_at = null
   where id = '2b000000-0000-4000-8000-000000000001';" >/dev/null

race() {
  psql -X -tA -d "$DB" <<'SQL'
begin;
select case when public_link_lookup(encode(sha256('token-b'::bytea),'hex'), true) is null
            then 'REFUSED' else 'ALLOWED' end;
select pg_sleep(0.6);
commit;
SQL
}

race > /tmp/verify-race-a.out 2>&1 &
race > /tmp/verify-race-b.out 2>&1 &
wait

allowed=$(cat /tmp/verify-race-a.out /tmp/verify-race-b.out | grep -c '^ALLOWED$' || true)
refused=$(cat /tmp/verify-race-a.out /tmp/verify-race-b.out | grep -c '^REFUSED$' || true)
count=$(psql -X -tA -d "$DB" \
  -c "select use_count from template_links where id='2b000000-0000-4000-8000-000000000001';")

if [ "$allowed" = "1" ] && [ "$refused" = "1" ] && [ "$count" = "1" ]; then
  echo "pass  exactly one of two simultaneous visitors claims the last use"
else
  echo "FAIL: the use cap is not claimed atomically (allowed=$allowed refused=$refused count=$count)"
  exit 1
fi

echo
echo "ALL CHECKS PASSED"

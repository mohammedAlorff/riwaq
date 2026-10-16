# Regression tests

Run from the workspace root:

```sh
node riwaq/tests/integration.cjs
```

Requires Node 20+, PHP 8+ with pdo_mysql, mbstring and fileinfo, and a local MySQL
server. The Windows bundled PHP is detected automatically; otherwise use PHP on
PATH or set `RIWAQ_TEST_PHP`. The runner reads the host/port from
`api/config.local.php` or `RIWAQ_TEST_SOURCE_CONFIG`. It refuses remote hosts.
Use `RIWAQ_TEST_DB_USER` / `RIWAQ_TEST_DB_PASSWORD` for a local database account
that can create test databases (defaults: root with an empty password).

Every run creates a randomly named `riwaq_test_*` database from `schema.sql`,
synthetic credentials and a temporary upload directory. A PHP server listens on
an ephemeral loopback port; concurrency tests add a second temporary server.
The runner removes only its own database, processes
and temporary directory in `finally`. It never reads or clones application data.

For browser coverage, install/use Playwright in the development environment and
set `RIWAQ_TEST_BROWSER=1`. `RIWAQ_TEST_BROWSER_CHANNEL=msedge` or `chrome` uses
an installed browser. Optional `RIWAQ_TEST_SCREENSHOTS` points to an existing
directory for desktop/mobile screenshots. No screenshot contains real accounts.

The checks cover anonymous and role authorization, club ownership, session-bound
CSRF, proxy trust, login limit retention, session expiry, input validation,
event/post consistency, password resets, logout, deployment routes, and browser
journeys across the three separate portals.

`experience.cjs` adds event search/category-period combinations and chronological
ordering, independent in-memory composer drafts, image previews, interrupted
publication retries without duplicate uploads, logout draft cleanup, and admin
club category/account-state filters. It checks layouts at 1440, 390 and 320px.
The image decoder regression uses an explicit browser-side barrier to verify
removing an image during replacement does not leave publication disabled.
Image-post tests reject another club's upload, traversal paths, external URLs,
invalid types and missing files. `router.php` serves only synthetic raster uploads
from the isolated test directory, without adding a public production route.

The full suite with browser coverage has 27 test groups. Eight lower-level
proxy/session assertions run inside one of those groups.

Concurrency tests use database locks and temporary test-only triggers to reproduce
password-reset/login races, duplicate club IDs and duplicate president accounts.
They wait for requests to reach a database barrier, not a fixed sleep. The local
test account needs permission to create triggers and inspect its own connections.
An injected missing-table failure also verifies JSON 500 responses without SQL
or stack-trace disclosure. Rate-limit fixtures are cleared only in the synthetic
database between these scenarios and the independent spoofing test.

Apache configuration is not exercised by the PHP development server. Verify
`.htaccess` behavior on the actual Apache host before a permanent deployment.

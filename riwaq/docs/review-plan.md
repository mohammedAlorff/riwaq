# Riwaq review

Risk: Level 3 (authentication, club isolation, public deployment).

## Contract

Preserve the three entry points: public students, club presidents, administrator.
Public callers cannot write. Presidents can write only for their own club and
cannot manage accounts or clubs. Existing data and credentials must survive.
No working-database migration or data reset is part of this review. The isolated
preview's missing foreign keys are restored after checking for orphaned rows.

## Work

- [x] Read source, schema, deployment rules and existing changes.
- [x] Reproduce defects using an isolated local test database (six failing groups).
- [x] Correct authentication, input validation and deployment boundaries.
- [x] Verify API authorization, lifecycle operations and browser workflows (19 groups passed).
- [x] Record commands, results and remaining deployment limitations in review-report.md.

## Follow-up concurrency review

- [x] Reproduce in-flight login/password-reset and simultaneous creation races (five failing groups).
- [x] Make session issuance and club/account creation safe under concurrency.
- [x] Repeat isolated API/browser tests (24 groups passed) and verify the shared HTTPS preview.
- [x] Check local Apache availability: XAMPP has residual folders, but no httpd executable.

## Verification

Use a generated `riwaq_test_*` database with synthetic users and clubs. Never run
destructive tests against the local working database or the shared preview.
Test anonymous requests, cross-role requests, cross-club deletion, CSRF,
malformed data, event/post consistency, password reset and session invalidation.
Check browser navigation and both management login pages, then smoke-check the
existing public tunnel. Tests and tools stay outside the public route allowlist.

## Rollout

No application schema migration is required. Six foreign keys omitted by the
preview clone were restored without changing rows. PHP edits take effect on the existing local
and preview servers. Reload management pages after CSRF changes. Reverting this
review's code changes needs no data rollback. Apache rules require an Apache
deployment check separately from the PHP development server.

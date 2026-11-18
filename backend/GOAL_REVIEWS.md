# Goal reviews

POST /api/goals and PUT /api/goals/{id} accept optional `reviewFrequency`:
`WEEKLY`, `BIWEEKLY`, `MONTHLY`, `QUARTERLY`. Existing title and description validation remains unchanged.
Omitting the field on PUT preserves its configuration; explicit null disables reviews and clears the date.
Sending the same frequency preserves the deadline. Enabling or changing it starts a new interval today.

Goal responses retain existing fields and add `reviewFrequency`, `nextReviewDate` (ISO date), and `reviewDue`.
The latter two are server-controlled; request values are ignored like other unknown fields.
Dates use Europe/Warsaw, consistent with habits and task priorities, with an injectable Clock.
Intervals use calendar weeks/months (including end-of-month clamping). No scheduler is needed.

Creating any journal entry on or after the due date schedules the next review from the entry's creation
date in Europe/Warsaw. Earlier entries, edits and deletes do not affect the schedule. There is no backlog,
review history, special entry type, reward or points adjustment.
The existing owner-scoped pessimistic goal lock serializes entry creation, configuration and completion.
Entry insertion and schedule changes commit or roll back together in the existing service transaction.

POST `/api/goals/{id}/entries` retains the entry fields and additionally returns `reviewCompleted`.
This boolean describes **this request's committed transaction**: exactly one of two concurrent due
entries returns true. It is not stored on the entry and is absent from GET history and PATCH responses.
Clients must not infer this result by comparing deadlines: another tab may have already completed a
review or changed the configuration. Clients using an older API without the flag use a neutral success
message. The frontend refreshes only the affected goal and shows the review success message only with
the POST confirmation and a successful, applicable refresh. A failed refresh offers a GET-only retry.

Completing a goal clears the deadline and preserves frequency. Reopening starts a new interval.
Completed goals retain existing read-only restrictions. Repeating completion/reopening does not reset dates.
V49 adds nullable columns; existing goals remain disabled.

The frontend uses the backend's `reviewDue` for badges and opens the existing journal editor through
an explicit component action, preserving drafts, history, the selected tab, focus and reduced motion.
List reads are refreshed on stale focus/visibility returns and a Warsaw day change, with a minute timer
that only checks the date (no continuous network polling). Freshness uses the request's start day, so
a response crossing midnight cannot suppress the following day's refresh. Request versions protect
newer detail reads and mutations from older list responses.

Tests: GoalReviewTests, GoalReviewControllerTests, GoalReviewSecurityTests and GoalReviewMigrationTests cover calendar rules,
API lifecycle, authentication, ownership, controlled Warsaw midnight, concurrency, rollback, constant query count and migration.

Verification commands (from the respective backend/frontend directories):

- `mvnw.cmd -o test`: real Spring MVC, service, transaction and H2 migration tests, including the full
  create / overdue entry / second entry / frequency change / complete / resume lifecycle.
- `mvnw.cmd -o -Dtest=GoalReview*Tests -Dtest.timezone=Pacific/Kiritimati test` (also
  `Pacific/Honolulu` and `UTC`): start each test JVM in the selected server zone. Do not change the
  JVM default zone while JDBC pools are running: drivers may cache their initial zone.
- `npm.cmd test`, `npm.cmd run build`, `npm.cmd run lint`.
- `node test/goalReviews.browser.mjs`, `node test/goalReviewStatus.browser.mjs`,
  `node test/goalReviewRefresh.browser.mjs`: configuration, journal integration, concurrent external
  completion, 320/360/390/tablet/desktop layouts, keyboard, errors and deterministic midnight races.
  Browser checks use the existing local Playwright installation and mocked API responses; they are
  not a real browser-to-PostgreSQL E2E test. Start Vite on port 5197 or set `TEST_URL`.

No production clock, test-only production endpoint, scheduler or new test framework is introduced.
H2 integration tests do not replace deployment verification against PostgreSQL.

The final audit corrected three issues:

- `GoalEntryService`, `GoalEntity`, `CreatedGoalEntryResponse`, `goalReviews.ts`: replaced ambiguous
  before/after deadline inference with the transaction's explicit POST confirmation.
- `GoalsPage.tsx`: fixed initial and background list reads that straddle Warsaw midnight.
- `FormSelect.tsx` and `App.css`: stopped passing Radix slot props to a React Fragment while preserving
  the existing icon/text layout, keyboard behavior and long-label truncation.

Coverage was extended in `GoalReviewControllerTests`, `GoalReviewTests`, `GoalReviewSecurityTests`,
`goalReviews.test.ts`, `goalReviews.browser.mjs`, `goalReviewStatus.browser.mjs` and the new
`goalReviewRefresh.browser.mjs`. The first timezone test changed the global JVM zone after JDBC pool
startup and failed due to cached driver/calendar conversions. It was replaced by stable per-process
server zones (`test.timezone` in `pom.xml`) plus injected clocks; dates are checked through both SQL
and the API. No production date logic was changed to accommodate that test artifact.

Final verification (2026-11-18): full backend suite 499/499; review suite 48/48 in each of
Pacific/Kiritimati, Pacific/Honolulu and UTC; frontend unit suite 116/116; 15 browser suites passed
(the three review suites, goal subtasks/statuses, five goal journal suites, four habit journal suites,
and milestones). TypeScript/Vite build, lint and `git diff --check` passed. Existing lint warnings
and the bundle-size warning remain. Browser and H2 integration coverage is not PostgreSQL E2E coverage.

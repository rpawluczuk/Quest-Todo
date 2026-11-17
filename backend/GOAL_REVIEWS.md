# Goal reviews (stage 1)

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

Completing a goal clears the deadline and preserves frequency. Reopening starts a new interval.
Completed goals retain existing read-only restrictions. Repeating completion/reopening does not reset dates.
V49 adds nullable columns; existing goals remain disabled. No frontend changes are included.

Tests: GoalReviewTests, GoalReviewControllerTests, GoalReviewSecurityTests and GoalReviewMigrationTests cover calendar rules,
API lifecycle, authentication, ownership, controlled Warsaw midnight, concurrency, rollback, constant query count and migration.

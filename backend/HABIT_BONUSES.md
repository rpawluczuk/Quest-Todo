# Date-based habit completion bonuses

Date-based bonuses use the existing `habit_completion_bonus_awards` ledger and account balance.
Weekly rewards are unchanged.

## Regularity

Weeks run Monday–Sunday. Only days between the start and end dates, inclusive, count.
The required completions for a partial week are `ceil(historicalWeeklyTarget * activeDays / 7)`.
Every included week has equal weight; surplus completions do not compensate for another week.
While the habit is running, only finished periods contribute to regularity.
Eligibility uses an exact comparison of counts; the displayed percentage is rounded to two decimals.

Habit responses retain the existing bonus configuration and expose:

- `regularity`: `successfulWeeks`, `totalWeeks`, `successPercent` (null percentage when no periods have finished).
- `completionBonusGranted`: whether the existing bonus award is active.
- `completionBonusSettledOn`: settlement date, including unsuccessful settlements; null before settlement.

## Settlement

The job runs independently of user sessions after the inclusive end date, using `HabitCalendar` (Europe/Warsaw).
It also picks up overdue, unsettled habits after a restart. Manually ended habits are excluded.

Configuration defaults:

- `app.habits.bonus-settlement-enabled=true`
- `app.habits.bonus-settlement-delay=60000` (milliseconds)
- `app.habits.bonus-settlement-initial-delay=1000` (milliseconds)

Each habit settles in a separate transaction. A habit lock serializes settlement and completion changes;
an account lock protects concurrent balance updates. The existing unique ledger entry stores the result
even when the threshold is not met, so subsequent job runs skip it. Failure rolls back both the
settlement and balance change and permits retry.

Explicit corrections to completion history reconcile the same ledger entry, reversing or restoring
its recorded amount when eligibility changes. They never create a second completion award.
V40 preserves existing count-based awards and adds nullable settlement metadata.

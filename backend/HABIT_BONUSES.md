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
- `completionBonusEverGranted`: true after any payment, false when known never paid,
  null when pre-V41 payment history is unknown. Reversal never resets this fact.
- `completionBonusConditionsLocked`: protected configuration (including ambiguous legacy history).
- `completionBonusAwardPoints`: actual currently credited completion award, null when inactive.
  This is separate from configurable `completionBonusPoints`, particularly for inconsistent legacy rows.

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

## Configuration changes (V41)

Configuration saves reconcile both count and dated bonuses in the same transaction as the edit.
Lowering an unpaid count limit to the existing completion count can therefore award immediately.
Disabled bonuses cannot activate an old inactive entry. Before any payment or final settlement,
the stored unpaid amount follows the configured amount.

After the first payment, or final date settlement even without payment, configuration is locked.
This covers start/end dates, count limit, bonus amount, percentage and ending mode. Weekly target
changes are blocked only if they can alter dated regularity (the edited week overlaps the period).
Count bonuses do not depend on weekly targets. Names, notes, category and goal links remain editable.
Both PUT routes enforce the same rule and return HTTP 409 before saving any part of a rejected edit.

Completion corrections remain allowed; the original amount is reversed/restored atomically.
Negative balances are allowed and purchases are not reversed. The first settlement date and grant
history remain permanent; regularity counts are refreshed after corrections. This is not an event log.
Manual ending before settlement does not earn a bonus, including through later historical completions.
Manual ending after payment/final settlement is rejected. A legacy manual flag on an already settled
dated habit does not itself disqualify its award when completion history is corrected.

The final-settlement lock takes precedence over the general pre-payment editing rule: an unsuccessful
final date settlement cannot be edited to lower its percentage or increase its amount. Its completion
history can still be corrected, and the originally configured award can subsequently become payable.

## Legacy migration limitations

V41 marks active rows as previously paid. Inactive old rows may be either never paid or reversed;
the old schema cannot distinguish these cases. Their `ever_granted` stays NULL and their conditions
are conservatively locked. New unpaid rows explicitly store false; later activation stores true.
Migration does not change balances, recorded amounts, configuration, completions or settlement results.

Original conditions that were edited before V41 cannot be recovered. Current persisted conditions
are protected going forward. If a protected inactive row has an amount different from configuration,
activation is rejected with 409 rather than guessing the right payout (the scheduler logs and retries).
These legacy inconsistencies require evidence-based administrative reconciliation; there is no new
user-facing repair flow in this stage. Existing active discrepancies are exposed through the separate
actual-award field without silently changing money. React/CSS are unchanged in this backend stage.

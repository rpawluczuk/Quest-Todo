-- NULL means that the old mutable ledger cannot establish previous payment history.
ALTER TABLE habit_completion_bonus_awards ADD COLUMN ever_granted BOOLEAN;
UPDATE habit_completion_bonus_awards SET ever_granted = TRUE WHERE active = TRUE;
-- Never classify old inactive rows as unpaid: they may represent a reversed payment.
ALTER TABLE habit_completion_bonus_awards ADD CONSTRAINT habit_bonus_grant_state_valid
    CHECK (active = FALSE OR ever_granted IS NULL OR ever_granted = TRUE);

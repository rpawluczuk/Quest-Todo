ALTER TABLE habits ADD COLUMN start_date DATE;
ALTER TABLE habits ADD COLUMN end_date DATE;
ALTER TABLE habits ADD COLUMN completion_limit INTEGER;
UPDATE habits SET start_date = created_on;
-- Keep older, legitimately backdated completions inside the initial schedule.
UPDATE habits SET start_date = (SELECT MIN(completion_date) FROM habit_completions c WHERE c.habit_id = habits.id)
WHERE EXISTS (SELECT 1 FROM habit_completions c WHERE c.habit_id = habits.id AND c.completion_date < habits.created_on);
ALTER TABLE habits ADD CONSTRAINT habit_schedule_valid CHECK (
    (end_date IS NULL OR end_date >= COALESCE(start_date, created_on))
    AND (completion_limit IS NULL OR completion_limit > 0)
    AND (end_date IS NULL OR completion_limit IS NULL)
);

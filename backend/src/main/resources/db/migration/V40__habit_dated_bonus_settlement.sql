ALTER TABLE habit_completion_bonus_awards ADD COLUMN settled_on DATE;
ALTER TABLE habit_completion_bonus_awards ADD COLUMN successful_weeks BIGINT;
ALTER TABLE habit_completion_bonus_awards ADD COLUMN total_weeks BIGINT;
ALTER TABLE habit_completion_bonus_awards ADD CONSTRAINT habit_bonus_regularity_valid CHECK (
    (settled_on IS NULL AND successful_weeks IS NULL AND total_weeks IS NULL)
    OR (settled_on IS NOT NULL AND successful_weeks IS NOT NULL AND total_weeks IS NOT NULL
        AND total_weeks > 0 AND successful_weeks >= 0 AND successful_weeks <= total_weeks)
);
CREATE INDEX habits_dated_bonus_due ON habits(end_date);

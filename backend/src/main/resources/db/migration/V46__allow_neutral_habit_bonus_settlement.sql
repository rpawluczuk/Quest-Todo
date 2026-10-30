ALTER TABLE habit_completion_bonus_awards DROP CONSTRAINT habit_bonus_regularity_valid;
ALTER TABLE habit_completion_bonus_awards ADD CONSTRAINT habit_bonus_regularity_valid CHECK (
    (settled_on IS NULL AND successful_weeks IS NULL AND total_weeks IS NULL)
    OR (settled_on IS NOT NULL AND successful_weeks IS NOT NULL AND total_weeks IS NOT NULL
        AND total_weeks >= 0 AND successful_weeks >= 0 AND successful_weeks <= total_weeks
        AND (total_weeks > 0 OR active = FALSE))
);

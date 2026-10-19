ALTER TABLE habits ADD COLUMN completion_bonus_points INTEGER;
ALTER TABLE habits ADD COLUMN required_success_percent INTEGER;

ALTER TABLE habits ADD CONSTRAINT habit_completion_bonus_valid CHECK (
    (completion_bonus_points IS NULL OR completion_bonus_points > 0)
    AND (required_success_percent IS NULL OR required_success_percent BETWEEN 1 AND 100)
    AND (required_success_percent IS NULL OR end_date IS NOT NULL)
    AND (completion_bonus_points IS NULL OR completion_limit IS NOT NULL
        OR (end_date IS NOT NULL AND required_success_percent IS NOT NULL))
);

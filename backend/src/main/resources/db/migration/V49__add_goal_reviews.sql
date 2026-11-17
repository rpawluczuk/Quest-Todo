ALTER TABLE goals ADD COLUMN review_frequency VARCHAR(20);
ALTER TABLE goals ADD COLUMN next_review_date DATE;
ALTER TABLE goals ADD CONSTRAINT chk_goal_review_frequency
    CHECK (review_frequency IN ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY'));

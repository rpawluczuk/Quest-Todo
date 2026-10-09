ALTER TABLE habits ADD COLUMN reward_points INTEGER NOT NULL DEFAULT 0 CHECK (reward_points >= 0);

CREATE TABLE habit_weekly_awards (
    id UUID PRIMARY KEY,
    habit_id BIGINT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    points INTEGER NOT NULL CHECK (points >= 0),
    completion_id BIGINT NOT NULL,
    completion_date DATE NOT NULL,
    undo_until TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT habit_weekly_award_unique UNIQUE (habit_id, week_start)
);

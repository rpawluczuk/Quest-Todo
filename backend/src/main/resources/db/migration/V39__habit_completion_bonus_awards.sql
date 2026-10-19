CREATE TABLE habit_completion_bonus_awards (
    habit_id BIGINT PRIMARY KEY REFERENCES habits(id) ON DELETE CASCADE,
    points INTEGER NOT NULL CHECK (points > 0),
    active BOOLEAN NOT NULL
);

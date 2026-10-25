ALTER TABLE goals ADD COLUMN completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE goals ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE goals ADD CONSTRAINT goals_completion_consistency CHECK (
    (completed = FALSE AND completed_at IS NULL)
    OR (completed = TRUE AND completed_at IS NOT NULL)
);

CREATE INDEX goals_owner_completion_idx ON goals(user_id, completed, completed_at DESC, id DESC);

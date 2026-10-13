ALTER TABLE tasks ADD COLUMN due_date DATE;
ALTER TABLE tasks ADD COLUMN due_time TIME;

ALTER TABLE tasks ADD CONSTRAINT tasks_due_time_requires_date
    CHECK (due_time IS NULL OR due_date IS NOT NULL);

CREATE INDEX tasks_owner_due_idx ON tasks(user_id, completed, due_date, due_time);

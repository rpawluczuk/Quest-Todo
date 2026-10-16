ALTER TABLE tasks
    ADD COLUMN automatic_priority_dismissed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX tasks_owner_history_idx ON tasks(user_id, completed, completed_at DESC, id DESC);

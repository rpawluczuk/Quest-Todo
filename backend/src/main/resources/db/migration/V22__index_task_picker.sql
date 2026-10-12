CREATE INDEX tasks_owner_status_focus_id_idx ON tasks(user_id, completed, in_focus, id);

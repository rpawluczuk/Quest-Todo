ALTER TABLE tasks
    ADD COLUMN category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX tasks_category_id_idx ON tasks(category_id);

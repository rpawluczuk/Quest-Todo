ALTER TABLE habits
    ADD COLUMN category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX habits_category_id_idx ON habits(category_id);

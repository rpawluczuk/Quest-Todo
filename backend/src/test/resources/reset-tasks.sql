DELETE FROM tasks;
ALTER TABLE tasks ALTER COLUMN id RESTART WITH 1;
INSERT INTO tasks (title, points, completed, in_focus) VALUES
    ('Poświęcić 20 minut na naukę Reacta', 20, FALSE, FALSE),
    ('Wybrać się na spacer', 15, FALSE, FALSE),
    ('Przeczytać rozdział książki', 10, FALSE, FALSE);

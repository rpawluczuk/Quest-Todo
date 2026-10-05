DELETE FROM purchases;
UPDATE users SET points = 0;
DELETE FROM tasks;
ALTER TABLE tasks ALTER COLUMN id RESTART WITH 1;
INSERT INTO tasks (title, points, completed, in_focus, user_id) VALUES
    ('Poświęcić 20 minut na naukę Reacta', 20, FALSE, FALSE, 1),
    ('Wybrać się na spacer', 15, FALSE, FALSE, 1),
    ('Przeczytać rozdział książki', 10, FALSE, FALSE, 1);

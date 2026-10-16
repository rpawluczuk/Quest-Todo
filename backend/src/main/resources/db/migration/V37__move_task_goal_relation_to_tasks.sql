ALTER TABLE tasks ADD COLUMN goal_id BIGINT;

UPDATE tasks
SET goal_id = (
    SELECT goal_tasks.goal_id
    FROM goal_tasks
    WHERE goal_tasks.task_id = tasks.id
)
WHERE EXISTS (
    SELECT 1
    FROM goal_tasks
    WHERE goal_tasks.task_id = tasks.id
);

ALTER TABLE tasks
    ADD CONSTRAINT tasks_goal_fk
    FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE SET NULL;

CREATE INDEX tasks_goal_idx ON tasks(goal_id);

DROP TABLE goal_tasks;

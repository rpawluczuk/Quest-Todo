-- Preserve previous weeks. Bring current and previously scheduled targets
-- into the current Warsaw week, keeping the latest configured value.
INSERT INTO habit_targets (habit_id, target_days, effective_from)
SELECT t.habit_id, t.target_days,
       CAST(DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Warsaw') AS DATE)
FROM habit_targets t
WHERE t.effective_from = (SELECT MAX(x.effective_from) FROM habit_targets x WHERE x.habit_id = t.habit_id)
  AND t.effective_from >= CAST(DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Warsaw') AS DATE)
  AND NOT EXISTS (SELECT 1 FROM habit_targets x WHERE x.habit_id = t.habit_id
      AND x.effective_from = CAST(DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Warsaw') AS DATE));

UPDATE habit_targets t SET target_days = (
    SELECT x.target_days FROM habit_targets x WHERE x.habit_id = t.habit_id
    ORDER BY x.effective_from DESC LIMIT 1
)
WHERE t.effective_from = CAST(DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Warsaw') AS DATE);

DELETE FROM habit_targets
WHERE effective_from > CAST(DATE_TRUNC('week', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Warsaw') AS DATE);

ALTER TABLE habits ADD COLUMN ended_on DATE;
ALTER TABLE habits ADD COLUMN end_reason VARCHAR(24);

ALTER TABLE habits ADD CONSTRAINT habit_manual_ending_complete CHECK (
    CASE
        WHEN ended_on IS NULL AND end_reason IS NULL THEN TRUE
        WHEN ended_on IS NOT NULL THEN
            CASE end_reason
                WHEN 'ACHIEVED' THEN TRUE
                WHEN 'ESTABLISHED' THEN TRUE
                WHEN 'STOPPED' THEN TRUE
                ELSE FALSE
            END
        ELSE FALSE
    END
);

-- Historical completion dates are unknown and intentionally remain NULL.
ALTER TABLE tasks ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;

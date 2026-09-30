-- Existing purchases remain available; their original purchase dates are unknown.
ALTER TABLE purchases ADD COLUMN purchased_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE purchases ADD COLUMN used_at TIMESTAMP WITH TIME ZONE;

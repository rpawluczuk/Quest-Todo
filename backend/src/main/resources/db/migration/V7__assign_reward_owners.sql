ALTER TABLE rewards ADD COLUMN user_id BIGINT REFERENCES users(id);

-- All existing offers, including deleted ones, belong to the original account.
UPDATE rewards SET user_id = 1;

ALTER TABLE rewards ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX rewards_user_id_idx ON rewards(user_id);

-- New records must explicitly receive the current user's ID from the backend.
ALTER TABLE tasks ALTER COLUMN user_id DROP DEFAULT;

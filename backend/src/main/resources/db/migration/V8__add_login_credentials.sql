ALTER TABLE users ADD COLUMN login VARCHAR(64);
ALTER TABLE users ADD COLUMN password_hash VARCHAR(100);
ALTER TABLE users ADD CONSTRAINT users_login_unique UNIQUE (login);
ALTER TABLE users ADD CONSTRAINT users_credentials_pair CHECK (
    (login IS NULL AND password_hash IS NULL) OR
    (login IS NOT NULL AND password_hash IS NOT NULL)
);

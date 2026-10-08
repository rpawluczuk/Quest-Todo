-- Legacy notifications have no reliable owner: their recipient is the old address.
-- Keep them for delivery; all newly queued notifications are linked to the account.
ALTER TABLE email_notification ADD COLUMN user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX email_notification_user_idx ON email_notification(user_id);

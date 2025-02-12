-- Add new notification type in its own transaction
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'changeover_deleted';
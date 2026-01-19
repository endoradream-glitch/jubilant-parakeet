-- Add missing columns to authorization_requests
ALTER TABLE authorization_requests 
ADD COLUMN IF NOT EXISTS device_name TEXT;

-- Add missing columns to authorized_devices
ALTER TABLE authorized_devices 
ADD COLUMN IF NOT EXISTS device_name TEXT,
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE;
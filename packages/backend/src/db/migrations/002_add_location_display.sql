-- Add location_display column to store the human-readable address string
ALTER TABLE professional_profiles ADD COLUMN IF NOT EXISTS location_display TEXT;

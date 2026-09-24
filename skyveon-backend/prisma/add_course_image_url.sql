-- Migration: add_course_image_url
-- Run on the production database to add course cover image support.
-- Safe to run multiple times (uses IF NOT EXISTS).

ALTER TABLE courses ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

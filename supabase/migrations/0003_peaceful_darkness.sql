/*
  # Fix RLS policies for findings and storage

  1. Changes
    - Add storage policies for authenticated users to upload files
    - Fix findings table policies to allow proper access
    - Add missing storage bucket policies

  2. Security
    - Ensure authenticated users can upload to storage
    - Allow authenticated users to view and create findings
    - Maintain data security while fixing access issues
*/

-- Drop existing policies to recreate them correctly
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view findings" ON findings;
DROP POLICY IF EXISTS "Users can create findings" ON findings;
DROP POLICY IF EXISTS "Users can update their own findings" ON findings;

-- Storage policies
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'findings');

CREATE POLICY "Allow public viewing of findings images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'findings');

-- Findings table policies
CREATE POLICY "Public can view findings"
ON findings FOR SELECT
TO public
USING (true);

CREATE POLICY "Authenticated users can create findings"
ON findings FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update their own findings"
ON findings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Ensure storage bucket exists and is public
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('findings', 'findings', true)
  ON CONFLICT (id) DO UPDATE
  SET public = true;
END $$;
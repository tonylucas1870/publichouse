/*
  # Create contents storage bucket and policies

  1. Changes
    - Create contents storage bucket if not exists
    - Drop existing policies to avoid conflicts
    - Create new storage policies for contents bucket
*/

-- Create contents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('contents', 'contents', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload contents images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view contents images" ON storage.objects;

-- Create storage policies for contents bucket
CREATE POLICY "Users can upload contents images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contents');

CREATE POLICY "Public can view contents images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'contents');
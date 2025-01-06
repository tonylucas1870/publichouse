/*
  # Create storage bucket for findings images
  
  1. Storage
    - Create public bucket for findings images
    - Enable public access to images
*/

-- Create bucket for findings images
INSERT INTO storage.buckets (id, name, public)
VALUES ('findings', 'findings', true);

-- Allow public access to images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'findings');
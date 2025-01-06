/*
  # Add furniture images support

  1. Changes
    - Create storage bucket for furniture images
    - Add policies for furniture image access
*/

-- Create bucket for furniture images
INSERT INTO storage.buckets (id, name, public)
VALUES ('furniture', 'furniture', true);

-- Allow authenticated users to upload furniture images
CREATE POLICY "Users can upload furniture images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'furniture');

-- Allow public access to furniture images
CREATE POLICY "Public can view furniture images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'furniture');
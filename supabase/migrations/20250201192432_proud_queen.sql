/*
  # Configure Storage for Media Proofs
  
  1. Storage Buckets
    - media_proofs: Stores media files with proof metadata
    - findings: Stores finding images/videos
    - contents: Stores content item images/videos
  
  2. Security
    - RLS policies for bucket access
    - File size limits
    - MIME type restrictions
*/

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('media_proofs', 'media_proofs', false, 104857600, -- 100MB
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']),
  ('findings', 'findings', true, 104857600,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']),
  ('contents', 'contents', true, 104857600,
   ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])
ON CONFLICT (id) DO UPDATE
SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create storage policies
DO $$
BEGIN
  -- Media Proofs bucket policies
  PERFORM storage.create_policy(
    'media_proofs',
    'authenticated-insert',
    'INSERT',
    'authenticated',
    storage.foldername(name) = 'media_proofs',
    true
  );

  PERFORM storage.create_policy(
    'media_proofs',
    'authenticated-select',
    'SELECT',
    'authenticated',
    storage.foldername(name) = 'media_proofs',
    true
  );

  -- Findings bucket policies
  PERFORM storage.create_policy(
    'findings',
    'authenticated-insert',
    'INSERT',
    'authenticated',
    storage.foldername(name) = 'findings',
    true
  );

  PERFORM storage.create_policy(
    'findings',
    'public-select',
    'SELECT',
    'public',
    storage.foldername(name) = 'findings',
    true
  );

  -- Contents bucket policies
  PERFORM storage.create_policy(
    'contents',
    'authenticated-insert',
    'INSERT',
    'authenticated',
    storage.foldername(name) = 'contents',
    true
  );

  PERFORM storage.create_policy(
    'contents',
    'public-select',
    'SELECT',
    'public',
    storage.foldername(name) = 'contents',
    true
  );
END $$;
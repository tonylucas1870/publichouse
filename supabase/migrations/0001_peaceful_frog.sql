/*
  # Create findings table and storage

  1. New Tables
    - `findings`
      - `id` (uuid, primary key)
      - `description` (text)
      - `location` (text)
      - `image_url` (text)
      - `date_found` (timestamp with time zone)
      - `status` (enum: pending, claimed, disposed)
      - `user_id` (uuid, foreign key to auth.users)
      - `created_at` (timestamp with time zone)

  2. Security
    - Enable RLS on findings table
    - Add policies for CRUD operations
*/

-- Create enum type for status
CREATE TYPE finding_status AS ENUM ('pending', 'claimed', 'disposed');

-- Create findings table
CREATE TABLE IF NOT EXISTS findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  location text NOT NULL,
  image_url text NOT NULL,
  date_found timestamptz NOT NULL DEFAULT now(),
  status finding_status NOT NULL DEFAULT 'pending',
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view findings" 
  ON findings 
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "Users can create findings" 
  ON findings 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own findings" 
  ON findings 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = user_id);
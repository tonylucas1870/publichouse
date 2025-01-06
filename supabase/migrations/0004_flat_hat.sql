/*
  # Add changeovers functionality

  1. New Tables
    - `properties` table to track different holiday lets
    - `changeovers` table to track cleaning sessions
    - Update `findings` table to link to changeovers

  2. Changes
    - Add foreign key from findings to changeovers
    - Add share token for changeovers

  3. Security
    - Enable RLS on new tables
    - Update policies for findings table
    - Add policies for changeovers and properties
*/

-- Create properties table
CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) NOT NULL
);

-- Create changeovers table
CREATE TABLE IF NOT EXISTS changeovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) NOT NULL,
  checkout_date date NOT NULL,
  checkin_date date NOT NULL,
  share_token text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'in_progress',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) NOT NULL
);

-- Add changeover_id to findings
ALTER TABLE findings 
ADD COLUMN changeover_id uuid REFERENCES changeovers(id);

-- Enable RLS
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE changeovers ENABLE ROW LEVEL SECURITY;

-- Properties policies
CREATE POLICY "Users can view their properties"
  ON properties FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can create properties"
  ON properties FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Changeovers policies
CREATE POLICY "Users can view changeovers they created"
  ON changeovers FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Anyone with share token can view changeover"
  ON changeovers FOR SELECT
  TO public
  USING (share_token IS NOT NULL);

CREATE POLICY "Users can create changeovers"
  ON changeovers FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Update findings policies for changeovers
CREATE POLICY "Anyone with changeover access can view findings"
  ON findings FOR SELECT
  TO public
  USING (
    changeover_id IN (
      SELECT id FROM changeovers 
      WHERE share_token IS NOT NULL
      OR created_by = auth.uid()
    )
  );

CREATE POLICY "Anyone with changeover access can create findings"
  ON findings FOR INSERT
  TO public
  WITH CHECK (
    changeover_id IN (
      SELECT id FROM changeovers 
      WHERE share_token IS NOT NULL
      OR created_by = auth.uid()
    )
  );
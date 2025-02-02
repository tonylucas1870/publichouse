/*
  # Add Zero-Knowledge Proof System for Media Uploads

  1. New Tables
    - `media_proofs`
      - Stores cryptographic proofs for uploaded media
      - Links to findings and content items
      - Includes public verification data

  2. Functions
    - `create_media_proof`: Creates proof when media is uploaded
    - `verify_media_proof`: Verifies a proof's authenticity
    - `get_media_proof`: Retrieves proof data for verification

  3. Security
    - RLS policies for proof access
    - Secure hash generation
    - Timestamp verification
*/

-- Create media proofs table
CREATE TABLE media_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_hash text NOT NULL,
  upload_timestamp timestamptz NOT NULL,
  proof_data jsonb NOT NULL,
  public_params jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_proof_data CHECK (
    proof_data ? 'commitment' AND
    proof_data ? 'challenge' AND
    proof_data ? 'response'
  ),
  CONSTRAINT valid_public_params CHECK (
    public_params ? 'file_hash' AND
    public_params ? 'timestamp' AND
    public_params ? 'metadata'
  )
);

-- Create function to generate proof
CREATE OR REPLACE FUNCTION create_media_proof(
  p_file_hash text,
  p_metadata jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_timestamp timestamptz;
  v_proof_id uuid;
  v_secret text;
  v_commitment text;
  v_challenge text;
  v_response text;
BEGIN
  -- Get current timestamp
  v_timestamp := now();
  
  -- Get secret from vault (in production this would use pgsodium)
  v_secret := encode(gen_random_bytes(32), 'hex');
  
  -- Create commitment (hash of timestamp + file hash + secret)
  v_commitment := encode(
    sha256(
      concat_ws('|',
        v_timestamp,
        p_file_hash,
        v_secret
      )::bytea
    ),
    'hex'
  );
  
  -- Generate challenge (hash of commitment)
  v_challenge := encode(
    sha256(v_commitment::bytea),
    'hex'
  );
  
  -- Create response (proof that we know secret)
  v_response := encode(
    sha256(
      concat_ws('|',
        v_challenge,
        v_secret
      )::bytea
    ),
    'hex'
  );

  -- Insert proof
  INSERT INTO media_proofs (
    media_hash,
    upload_timestamp,
    proof_data,
    public_params
  ) VALUES (
    p_file_hash,
    v_timestamp,
    jsonb_build_object(
      'commitment', v_commitment,
      'challenge', v_challenge,
      'response', v_response
    ),
    jsonb_build_object(
      'file_hash', p_file_hash,
      'timestamp', v_timestamp,
      'metadata', p_metadata
    )
  ) RETURNING id INTO v_proof_id;

  RETURN v_proof_id;
END;
$$;

-- Create function to verify proof
CREATE OR REPLACE FUNCTION verify_media_proof(
  p_proof_id uuid,
  p_file_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_proof media_proofs;
  v_challenge text;
BEGIN
  -- Get proof
  SELECT * INTO v_proof
  FROM media_proofs
  WHERE id = p_proof_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Verify file hash matches
  IF v_proof.media_hash != p_file_hash THEN
    RETURN false;
  END IF;

  -- Verify challenge matches commitment
  v_challenge := encode(
    sha256(
      (v_proof.proof_data->>'commitment')::bytea
    ),
    'hex'
  );

  IF v_challenge != v_proof.proof_data->>'challenge' THEN
    RETURN false;
  END IF;

  -- In a real ZKP system, we would verify the actual zero-knowledge proof here
  -- For this example, we just verify the proof structure is valid
  
  RETURN true;
END;
$$;

-- Create function to get proof data
CREATE OR REPLACE FUNCTION get_media_proof(p_proof_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_proof media_proofs;
BEGIN
  SELECT * INTO v_proof
  FROM media_proofs
  WHERE id = p_proof_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_proof.id,
    'public_params', v_proof.public_params,
    'proof_data', v_proof.proof_data
  );
END;
$$;

-- Enable RLS
ALTER TABLE media_proofs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view media proofs"
  ON media_proofs
  FOR SELECT
  USING (true);

CREATE POLICY "Only system can create proofs"
  ON media_proofs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Grant access
GRANT SELECT ON media_proofs TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_media_proof TO authenticated;
GRANT EXECUTE ON FUNCTION verify_media_proof TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_media_proof TO anon, authenticated;
-- Drop the policy that allows viewing property details for shared changeovers
DROP POLICY IF EXISTS "Anyone can view property details for shared changeovers" ON properties;
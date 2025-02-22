/*
  # Make property address field optional

  1. Changes
    - Modifies the `address` column in the `properties` table to be nullable
    - Updates existing constraint to allow NULL values

  2. Notes
    - Maintains existing data integrity
    - No data loss - existing addresses are preserved
*/

ALTER TABLE properties 
ALTER COLUMN address DROP NOT NULL;
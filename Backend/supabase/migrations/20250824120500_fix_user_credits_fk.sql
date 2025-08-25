-- First, drop the existing foreign key constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_credits_user_id_fkey'
    ) THEN
        ALTER TABLE public.user_credits 
        DROP CONSTRAINT user_credits_user_id_fkey;
    END IF;
END $$;

-- Add the correct foreign key constraint
ALTER TABLE public.user_credits
ADD CONSTRAINT user_credits_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Also, we should add a unique constraint on user_id to ensure one-to-one relationship
ALTER TABLE public.user_credits
ADD CONSTRAINT user_credits_user_id_key UNIQUE (user_id);

-- Verify the changes
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE 
    tc.table_name = 'user_credits' 
    AND tc.table_schema = 'public';

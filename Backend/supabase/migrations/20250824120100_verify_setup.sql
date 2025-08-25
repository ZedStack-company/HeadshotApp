-- 1. Check if required tables exist
SELECT 
    table_name,
    'exists' as status,
    (SELECT count(*) FROM information_schema.columns 
     WHERE table_name = t.table_name) as column_count
FROM 
    information_schema.tables t
WHERE 
    table_schema = 'public' 
    AND table_name IN ('profiles', 'user_credits', 'credits_config', 'prompt_mappings')
UNION ALL
SELECT 
    table_name,
    'missing' as status,
    0 as column_count
FROM 
    (VALUES ('profiles'), ('user_credits'), ('credits_config'), ('prompt_mappings')) as expected_tables(table_name)
WHERE 
    table_name NOT IN (
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    );

-- 2. Check triggers on auth.users
SELECT 
    trigger_name,
    'exists' as status
FROM 
    information_schema.triggers 
WHERE 
    event_object_table = 'users' 
    AND event_object_schema = 'auth'
    AND trigger_name = 'on_auth_user_created';

-- 3. Check if functions exist
SELECT 
    routine_name,
    'exists' as status
FROM 
    information_schema.routines 
WHERE 
    routine_schema = 'public'
    AND routine_name IN ('handle_new_user', 'reset_daily_credits', 'get_user_credits');

-- 4. Check RLS policies
SELECT 
    tablename,
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM 
    pg_policies 
WHERE 
    schemaname = 'public' 
    AND tablename IN ('profiles', 'user_credits');

-- 5. Check table permissions
SELECT 
    table_schema,
    table_name,
    privilege_type,
    grantee
FROM 
    information_schema.role_table_grants 
WHERE 
    table_schema = 'public' 
    AND table_name IN ('profiles', 'user_credits')
    AND grantee IN ('authenticated', 'anon');

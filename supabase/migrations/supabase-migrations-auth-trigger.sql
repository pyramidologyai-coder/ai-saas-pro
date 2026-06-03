-- Function to automatically create a tenant when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user_tenant()
RETURNS trigger AS $$
DECLARE
    v_business_name TEXT;
    v_business_type TEXT;
    v_slug TEXT;
    v_trial_ends_at TIMESTAMP;
BEGIN
    -- Extract metadata from the signup request
    v_business_name := COALESCE(new.raw_user_meta_data->>'business_name', 'نشاط تجاري جديد');
    v_business_type := COALESCE(new.raw_user_meta_data->>'business_type', 'clinic');
    
    -- Generate a unique slug
    v_slug := lower(regexp_replace(v_business_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || floor(random() * 100000)::text;
    
    -- Set 7 days trial
    v_trial_ends_at := CURRENT_TIMESTAMP + INTERVAL '7 days';

    -- Insert the new tenant bypassing RLS
    INSERT INTO public.tenants (user_id, name, type, slug, subscription_status, trial_ends_at)
    VALUES (
        new.id, 
        v_business_name, 
        v_business_type, 
        v_slug, 
        'trial',
        v_trial_ends_at
    );

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger that fires after a user is inserted into auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_tenant();

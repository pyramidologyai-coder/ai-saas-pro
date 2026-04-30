ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_type_check;

ALTER TABLE tenants ADD CONSTRAINT tenants_type_check 
CHECK (type IN ('clinic', 'real_estate', 'salon', 'car_rental', 'ecommerce', 'restaurant', 'other'));

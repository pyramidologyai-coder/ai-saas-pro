const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dojbgvjrswktblkwwffx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvamJndmpyc3drdGJsa3d3ZmZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzM5OTYsImV4cCI6MjA5MjI0OTk5Nn0.yKSHL2zh3yc6PjFppGa6dbkzd7b2gwaPKPlMlsSdPME';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixArabicData() {
  console.log('Cleaning old data...');
  await supabase.from('items').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('Inserting correct Arabic data...');
  const { data, error } = await supabase.from('items').insert([
    { 
      tenant_id: '13814bff-a653-439a-8891-2c5a81124eb8', 
      name: 'كشف أسنان عام', 
      description: 'فحص شامل للأسنان واللثة', 
      price: 500, 
      duration_minutes: 30, 
      category: 'Dentistry' 
    },
    { 
      tenant_id: '13814bff-a653-439a-8891-2c5a81124eb8', 
      name: 'تبييض أسنان ليزر', 
      description: 'تبييض احترافي بجلسة واحدة', 
      price: 2500, 
      duration_minutes: 60, 
      category: 'Cosmetic' 
    },
    { 
      tenant_id: '13814bff-a653-439a-8891-2c5a81124eb8', 
      name: 'حشو عصب', 
      description: 'علاج جذور متقدم', 
      price: 1500, 
      duration_minutes: 45, 
      category: 'Treatment' 
    }
  ]);

  if (error) {
    console.error('Error fixing data:', error);
  } else {
    console.log('Arabic data fixed successfully!');
  }
}

fixArabicData();

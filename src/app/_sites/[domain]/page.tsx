import 'server-only';

import React from 'react';
import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Custom domain page requires Supabase URL and service-role configuration.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export default async function CustomDomainPage({
  params,
}: {
  params: { domain: string };
}) {
  const { domain } = params;
  const supabaseAdmin = createSupabaseAdminClient();

  // 1. Fetch active tenant by custom domain. This uses a server-only admin
  // client so public RLS policies can remain closed for tenant data.
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('id, name, status, custom_logo_url, custom_brand_name')
    .eq('custom_domain', domain)
    .eq('status', 'active')
    .single();

  if (tenantError || !tenant) {
    if (tenantError && tenantError.code !== 'PGRST116') {
      console.error('[CustomDomainPage] Failed to fetch tenant for custom domain:', tenantError.message);
    }
    return notFound();
  }

  // 2. Fetch public services/menu for this tenant only. Keep the selected
  // columns narrow because service-role bypasses RLS.
  const { data: services, error: servicesError } = await supabaseAdmin
    .from('items')
    .select('id, name, price')
    .eq('tenant_id', tenant.id);

  if (servicesError) {
    console.error('[CustomDomainPage] Failed to fetch services for custom domain:', servicesError.message);
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', padding: '2rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        {tenant.custom_logo_url && (
          <img src={tenant.custom_logo_url} alt={tenant.name} style={{ width: '150px', borderRadius: '10px', marginBottom: '1rem' }} />
        )}
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          {tenant.custom_brand_name || tenant.name}
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          أهلاً بك في الصفحة الرسمية لـ {tenant.name}.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {services?.map((service: any) => (
            <div key={service.id} style={{ padding: '1.5rem', backgroundColor: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{service.name}</h3>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{service.price} EGP</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

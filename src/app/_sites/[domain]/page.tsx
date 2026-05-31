import React from 'react';
import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';

export default async function CustomDomainPage({
  params,
}: {
  params: { domain: string };
}) {
  const { domain } = params;

  // 1. Fetch tenant by custom domain
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('custom_domain', domain)
    .single();

  if (!tenant) {
    return notFound();
  }

  // 2. Fetch public services or menu
  const { data: services } = await supabase
    .from('items')
    .select('*')
    .eq('tenant_id', tenant.id);

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

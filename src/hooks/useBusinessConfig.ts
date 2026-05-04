import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { businessConfig, BusinessType } from '@/config/businessConfig';
import { getActiveTenant } from '@/lib/tenant';

export const useBusinessConfig = (tenantTypeParam?: string) => {
  const [tenantType, setTenantType] = useState<BusinessType>('realestate');

  useEffect(() => {
    if (tenantTypeParam) {
      setTenantType((tenantTypeParam as BusinessType) || 'realestate');
      return;
    }
    const fetchType = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const activeTenant = await getActiveTenant(session.user);
        if (activeTenant && activeTenant.type) {
          setTenantType((activeTenant.type as BusinessType) || 'realestate');
        } else {
          setTenantType((localStorage.getItem('demo_tenant_type') as BusinessType) || 'realestate');
        }
      }
    };
    fetchType();
  }, [tenantTypeParam]);

  const config = businessConfig[tenantType] || businessConfig.realestate;

  return {
    tenantType,
    config,
    terms: config.terms,
    sidebarLabels: config.sidebar
  };
};

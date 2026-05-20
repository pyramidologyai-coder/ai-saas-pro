'use client';
import React, { useEffect, useState } from 'react';
import ClientDashboard from '@/components/dashboard/ClientDashboard';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);

  useEffect(() => {
    async function checkAuthAndRole() {
      const supabaseClient = createClientComponentClient({
        supabaseUrl: SUPABASE_URL,
        supabaseKey: SUPABASE_ANON_KEY
      });

      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
          router.replace('/auth');
          return;
        }

        let isMasterByRpc = false;
        try {
          const { data } = await supabaseClient.rpc('is_master_admin');
          isMasterByRpc = !!data;
        } catch (e) {
          // Ignore
        }

        const isMaster = isMasterByRpc || session.user.user_metadata?.role === 'master_admin';
        setIsMasterAdmin(isMaster);

        if (isMaster) {
          router.replace('/master-admin');
        } else {
          setLoadingAuth(false);
        }

      } catch (err) {
        setIsMasterAdmin(false);
        setLoadingAuth(false);
      }
    }
    
    checkAuthAndRole();
  }, [router]);

  if (loadingAuth || isMasterAdmin) {
    return <div style={{ padding: '2rem' }}><CardSkeleton /><CardSkeleton /></div>;
  }

  return <ClientDashboard />;
}

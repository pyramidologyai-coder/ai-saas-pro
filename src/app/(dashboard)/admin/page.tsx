'use client';
import React, { useEffect, useState } from 'react';
import ClientDashboard from '@/components/dashboard/ClientDashboard';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
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
          setLoading(false);
        }

      } catch (err) {
        setIsMasterAdmin(false);
        setLoading(false);
      }
    }
    
    checkAuthAndRole();
  }, [router]);

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #1f1f1f',
          borderTop: '3px solid #6366f1',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return <ClientDashboard />;
}

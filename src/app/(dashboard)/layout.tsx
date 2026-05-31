'use client';

import React, { useEffect } from 'react';
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import TrialBlocker from "@/components/TrialBlocker";
import NeuralCommandBar from "@/components/NeuralCommandBar";
import { createClient } from '@/utils/supabase/client';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  useEffect(() => {
    const interval = setInterval(async () => {
      await supabase.auth.refreshSession();
    }, 10 * 60 * 1000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          window.location.href = '/auth';
        }
      }
    );

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-color)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <TrialBlocker>
            {children}
          </TrialBlocker>
        </main>
      </div>
      <NeuralCommandBar />
    </div>
  );
}

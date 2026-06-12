import React from 'react';
import { redirect } from 'next/navigation';
import DashboardShell from '@/components/DashboardShell';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  return <DashboardShell>{children}</DashboardShell>;
}

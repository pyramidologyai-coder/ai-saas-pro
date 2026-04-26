import React from 'react';
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import TrialBlocker from "@/components/TrialBlocker";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    </div>
  );
}

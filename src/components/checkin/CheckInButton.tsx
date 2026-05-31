import React, { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useBusinessConfig } from '@/hooks/useBusinessConfig';

interface CheckInButtonProps {
  bookingId: string;
  tenantType?: string;
  onStatusChange?: (status: string) => void;
}

export const CheckInButton: React.FC<CheckInButtonProps> = ({ bookingId, tenantType, onStatusChange }) => {
  const { sidebarLabels } = useBusinessConfig(tenantType);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleCheckIn = async (status: 'checked_in' | 'no_show') => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase
        .from('bookings')
        .update({
          check_in_status: status,
          check_in_time: status === 'checked_in' ? new Date().toISOString() : null,
          check_in_by: session?.user?.id,
          revenue_confirmed: status === 'checked_in'
        })
        .eq('id', bookingId);

      if (error) throw error;

      // Log to audit
      await supabase.from('audit_logs').insert({
        user_id: session?.user?.id,
        action: `booking_${status}`,
        resource: 'bookings',
        details: { booking_id: bookingId, status }
      });

      if (onStatusChange) onStatusChange(status);
    } catch (err) {
      console.error('Error updating check-in status:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button 
        disabled={loading}
        onClick={() => handleCheckIn('checked_in')}
        className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
      >
        {sidebarLabels.checkinButton}
      </button>
      <button 
        disabled={loading}
        onClick={() => handleCheckIn('no_show')}
        className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
      >
        لم يحضر
      </button>
    </div>
  );
};

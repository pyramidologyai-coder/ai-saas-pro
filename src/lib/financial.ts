import { supabase } from '@/lib/supabase';

export async function getFinancialDashboardData() {
  // 1. Fetch all agencies
  const { data: agencies } = await supabase.from('agencies').select('*');
  
  // 2. Fetch all tenants
  const { data: tenants } = await supabase.from('tenants').select('*');
  
  // 3. Fetch all messages (for AI cost & metrics)
  const { count: messagesCount } = await supabase.from('messages').select('*', { count: 'exact', head: true });
  
  // 4. Fetch unique clients (from bookings)
  const { data: bookings } = await supabase.from('bookings').select('customer_phone');
  const uniqueClients = new Set(bookings?.map(b => b.customer_phone)).size;

  const activeAgencies = agencies?.filter(a => a.subscription_status === 'active') || [];
  
  // Calculate Revenue
  // Agency subscription: $499/month
  const agencyRevenue = activeAgencies.length * 499;
  
  // Direct Clients (Tenants without agency_id)
  const directTenants = tenants?.filter(t => !t.agency_id && t.status !== 'suspended') || [];
  const directClientsRevenue = directTenants.length * 99; // Assuming $99/mo for direct clients

  // Additional Messages & Services (Simulated based on messages count)
  const extraMessagesRevenue = ((messagesCount || 0) > 10000 ? ((messagesCount || 0) - 10000) * 0.01 : 0);
  const additionalServicesRevenue = 1500; // Mocked extra services

  const totalRevenue = agencyRevenue + directClientsRevenue + extraMessagesRevenue + additionalServicesRevenue;

  // Calculate Costs
  const claudeCost = (messagesCount || 0) * 0.0015; // $0.0015 per message average
  const whatsappCost = (messagesCount || 0) * 0.005; // $0.005 per message
  const infrastructureCost = 250; // Vercel + Supabase
  const supportCost = 800; // Technical Support
  const marketingCost = 1200; // Marketing

  const totalCost = claudeCost + whatsappCost + infrastructureCost + supportCost + marketingCost;
  const netProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Prepare Agency Table Data
  const agencyPerformance = agencies?.map(agency => {
    const agencyTenants = tenants?.filter(t => t.agency_id === agency.id) || [];
    const agencyRevenueGenerated = agencyTenants.length * 99; // assuming they sell at $99
    const commission = agencyRevenueGenerated * 0.3;
    
    // Health status logic
    let healthStatus = 'ممتازة';
    if (agencyTenants.length === 0) healthStatus = 'خطر';
    else if (agencyTenants.length < 3) healthStatus = 'تحتاج دعم';

    return {
      id: agency.id,
      name: agency.name || 'وكالة غير مسماة',
      clientCount: agencyTenants.length,
      revenue: agencyRevenueGenerated,
      commission: commission,
      growth: Math.floor(Math.random() * 20) + 1, // simulated growth
      healthStatus,
      clients: agencyTenants.map(t => ({ id: t.id, name: t.name, type: t.type, status: t.status }))
    };
  }) || [];

  return {
    kpis: {
      totalRevenue,
      netProfit,
      activeAgenciesCount: activeAgencies.length,
      totalClients: tenants?.length || 0,
      todayAiMessages: Math.floor((messagesCount || 0) / 30) || 0, // Average daily
      profitMargin
    },
    revenueSources: [
      { name: 'اشتراكات الوكالات', value: agencyRevenue },
      { name: 'اشتراكات العملاء المباشرين', value: directClientsRevenue },
      { name: 'رسوم رسائل إضافية', value: extraMessagesRevenue },
      { name: 'خدمات إضافية', value: additionalServicesRevenue }
    ],
    costs: [
      { name: 'Claude/Gemini API', value: claudeCost },
      { name: 'WhatsApp & Meta API', value: whatsappCost },
      { name: 'Supabase & Vercel', value: infrastructureCost },
      { name: 'دعم فني', value: supportCost },
      { name: 'تسويق', value: marketingCost }
    ],
    agencyPerformance,
    alerts: [
      { type: 'warning', message: 'يوجد وكالات لم تنشط منذ أسبوعين.' },
      { type: 'danger', message: 'اشتراكات بعض العملاء قاربت على الانتهاء.' },
      { type: 'success', message: `أعلى وكالة نمواً هذا الشهر هي: ${agencyPerformance.sort((a,b) => b.growth - a.growth)[0]?.name || 'لا يوجد'}` }
    ]
  };
}

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { CognitiveEngine } from '@/lib/cognitive-engine';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) return NextResponse.json({ error: 'Invalid Token' }, { status: 401 });

    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenantId');
    const agencyId = url.searchParams.get('agencyId'); // For Profit View

    if (!tenantId && !agencyId) return NextResponse.json({ error: 'Missing tenant or agency ID' }, { status: 400 });

    // In a real app, verify that the 'user.id' owns this tenant/agency here.

    let metrics: any = {};

    if (tenantId) {
      // 1. Profit & Churn Predictor
      const profitData = await CognitiveEngine.calculateProfitAndChurn(tenantId);
      // 2. Conversion Funnel (The Triple Crown)
      const funnelData = await CognitiveEngine.getConversionFunnel(tenantId);
      // 3. AI Performance
      const aiData = await CognitiveEngine.getAIPerformanceMetrics(tenantId);
      
      // Calculate "Revenue Generated" (Mocked based on $50 per booking average)
      const avgBookingValue = 50; 
      const revenueGenerated = (funnelData.totalBookings || 0) * avgBookingValue;

      metrics = {
        wallet: {
          balance: profitData.walletBalance,
          burnRateDays: profitData.daysUntilWalletEmpty,
          apiCost: profitData.apiCost,
        },
        tripleCrown: {
          conversionRate: funnelData.conversionRate,
          revenueGenerated: revenueGenerated,
          resolutionRate: Math.min(100, Math.floor(((aiData.resolutionRate || 0) / (funnelData.uniqueLeads || 1)) * 100)) + '%'
        },
        risk: {
          churnRisk: profitData.churnRiskScore
        }
      };
    } else if (agencyId) {
       // Agency Profit View (Aggregate)
       // Mock aggregation for demonstration
       metrics = {
          netProfit: 1250.00,
          apiCosts: 45.00,
          netMargin: '96.4%',
          activeClinics: 12
       };
    }

    // 4. Zero-Knowledge UI (Payload returned encrypted conceptually, handled as JSON here for standard SWR)
    return NextResponse.json({ data: metrics }, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300' // Edge Computing Caching
      }
    });

  } catch (error: any) {
    console.error('BI Metrics Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

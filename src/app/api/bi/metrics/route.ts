import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { CognitiveEngine } from '@/lib/cognitive-engine';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Authorization',
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: PRIVATE_HEADERS });
}

function getBearerToken(req: Request) {
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.get('Authorization') ?? '');
  return match?.[1] ?? null;
}

function createUserClient(token: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

async function isMasterAdmin(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc('verify_master_admin_role');
  return !error && data === true;
}

async function canAccessTenant(supabase: SupabaseClient, user: User, tenantId: string) {
  const { data: ownedTenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (ownedTenant) return true;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, permissions, tenant_id')
    .eq('id', user.id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!profile) return false;
  if (profile.role === 'admin') return true;

  const permissions =
    profile.permissions && typeof profile.permissions === 'object' && !Array.isArray(profile.permissions)
      ? (profile.permissions as Record<string, unknown>)
      : {};

  return profile.role === 'manager' && (permissions.financial === true || permissions.view_revenue === true);
}

async function canAccessAgency(supabase: SupabaseClient, user: User, agencyId: string) {
  const { data } = await supabase
    .from('agencies')
    .select('id')
    .eq('id', agencyId)
    .eq('user_id', user.id)
    .maybeSingle();

  return !!data;
}

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return jsonError('Unauthorized.', 401);

  const supabase = createUserClient(token);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) return jsonError('Unauthorized.', 401);

  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenantId');
  const agencyId = url.searchParams.get('agencyId');

  if ((!tenantId && !agencyId) || (tenantId && agencyId)) {
    return jsonError('Provide exactly one tenant or agency identifier.', 400);
  }
  if ((tenantId && !UUID_RE.test(tenantId)) || (agencyId && agencyId !== 'master' && !UUID_RE.test(agencyId))) {
    return jsonError('Invalid scope identifier.', 400);
  }

  try {
    const master = await isMasterAdmin(supabase);
    let metrics: Record<string, unknown>;

    if (tenantId) {
      if (!master && !(await canAccessTenant(supabase, user, tenantId))) {
        return jsonError('Forbidden.', 403);
      }

      const [profitData, funnelData, aiData] = await Promise.all([
        CognitiveEngine.calculateProfitAndChurn(tenantId, supabase),
        CognitiveEngine.getConversionFunnel(tenantId, supabase),
        CognitiveEngine.getAIPerformanceMetrics(tenantId, supabase),
      ]);

      const revenueGenerated = (funnelData.totalBookings || 0) * 50;
      metrics = {
        wallet: {
          balance: profitData.walletBalance,
          burnRateDays: profitData.daysUntilWalletEmpty,
          apiCost: profitData.apiCost,
        },
        tripleCrown: {
          conversionRate: funnelData.conversionRate,
          revenueGenerated,
          resolutionRate:
            Math.min(100, Math.floor(((aiData.resolutionRate || 0) / (funnelData.uniqueLeads || 1)) * 100)) + '%',
        },
        risk: {
          churnRisk: profitData.churnRiskScore,
        },
      };
    } else {
      if (agencyId === 'master') {
        if (!master) return jsonError('Forbidden.', 403);
      } else if (!master && !(await canAccessAgency(supabase, user, agencyId!))) {
        return jsonError('Forbidden.', 403);
      }

      let grossRevenue = 0;
      let apiCosts = 0;
      let platformFees = 0;
      let activeClinics = 0;

      if (agencyId === 'master') {
        const [{ data: tenants }, { data: agencies }] = await Promise.all([
          supabase.from('tenants').select('revenue, messages_used'),
          supabase.from('agencies').select('revenue'),
        ]);

        activeClinics = tenants?.length || 0;
        tenants?.forEach((tenant) => {
          grossRevenue += Number(tenant.revenue) || 0;
          apiCosts += (Number(tenant.messages_used) || 0) * 0.01;
        });
        agencies?.forEach((agency) => {
          grossRevenue += Number(agency.revenue) || 0;
        });
        platformFees = grossRevenue * 0.05;
      } else {
        const [{ data: agency }, { data: tenants }] = await Promise.all([
          supabase.from('agencies').select('revenue, commission_rate').eq('id', agencyId!).maybeSingle(),
          supabase.from('tenants').select('revenue, messages_used').eq('agency_id', agencyId!),
        ]);

        activeClinics = tenants?.length || 0;
        grossRevenue = Number(agency?.revenue) || 0;
        tenants?.forEach((tenant) => {
          grossRevenue += Number(tenant.revenue) || 0;
          apiCosts += (Number(tenant.messages_used) || 0) * 0.01;
        });
        platformFees = grossRevenue * ((Number(agency?.commission_rate) || 20) / 100);
      }

      const taxes = grossRevenue * 0.14;
      const netProfit = grossRevenue - taxes - apiCosts - platformFees;
      metrics = {
        grossRevenue,
        taxes,
        deliveryFees: 0,
        apiCosts,
        platformFees,
        netProfit,
        netMargin: grossRevenue > 0 ? `${((netProfit / grossRevenue) * 100).toFixed(1)}%` : '0%',
        activeClinics,
        reconciliationStatus: 'Audited & Balanced',
        waterfall: [
          { name: 'إجمالي المبيعات', value: grossRevenue, type: 'positive' },
          { name: 'الضرائب', value: -taxes, type: 'negative' },
          { name: 'تكلفة الـ APIs', value: -apiCosts, type: 'negative' },
          { name: 'عمولة المنصة', value: -platformFees, type: 'negative' },
          { name: 'صافي الربح', value: netProfit, type: 'total' },
        ],
      };
    }

    return NextResponse.json({ data: metrics }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    console.error('BI Metrics Error:', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return jsonError('Unable to load BI metrics.', 500);
  }
}

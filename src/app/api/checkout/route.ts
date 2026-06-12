import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { KMS } from '@/lib/kms';

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const body = await req.json();
    const { tenantId, planId, gateway } = body;

    if (!tenantId || !planId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - Missing token' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 });
    }

    // 1. Fetch Tenant and Agency Data using Admin Client to bypass RLS and get Agency keys
    // (SECURITY: Still strictly ensuring the tenant belongs to the authenticated user.id)
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('*, agency:agencies(*)')
      .eq('id', tenantId)
      .eq('user_id', user.id)
      .single();

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // 2. We ALWAYS use the Master Admin's Stripe Secret Key.
    // If the tenant belongs to an agency, we use Stripe Connect (Destination Charges)
    // ZERO TRUST: Using KMS instead of process.env
    const stripeSecretKey = await KMS.getSecret('STRIPE_SECRET_KEY');
    
    if (!stripeSecretKey && gateway === 'stripe') {
      return NextResponse.json({ error: 'Master Payment gateway not configured correctly.' }, { status: 500 });
    }

    // Determine pricing based on plan (Basic = $50, Pro = $100)
    // 1000-YEAR HACKER DEFENSE: Never trust the client with prices. Fetch from DB if available.
    const { data: platformSettings } = await supabaseAdmin.from('platform_settings').select('agency_base_fee').limit(1).single();
    const baseFee = platformSettings?.agency_base_fee || 50; 
    
    // Pro is usually double the base fee or a fixed rate.
    const amountInCents = planId === 'pro' ? (baseFee * 2) * 100 : baseFee * 100;
    const planName = planId === 'pro' ? 'الباقة الاحترافية (PRO)' : 'الباقة الأساسية';

    if (gateway === 'stripe') {
      // 3. Create Stripe Checkout Session via direct HTTP request (no SDK required)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const successUrl = `${appUrl}/billing?success=true`;
      const cancelUrl = `${appUrl}/billing?canceled=true`;

      const params = new URLSearchParams({
        'payment_method_types[0]': 'card',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': planName,
        'line_items[0][price_data][unit_amount]': amountInCents.toString(),
        'line_items[0][quantity]': '1',
        'mode': 'subscription',
        'success_url': successUrl,
        'cancel_url': cancelUrl,
        'client_reference_id': tenantId, // Important to link the webhook back to tenant
        'metadata[planId]': planId,
        'metadata[tenantId]': tenantId,
        'subscription_data[metadata][planId]': planId,
        'subscription_data[metadata][tenantId]': tenantId
      });

      // STRIPE CONNECT: Split the payment if an Agency owns this clinic
      if (tenant.agency && tenant.agency.stripe_account_id) {
        // The Master Admin takes the baseFee as their Application Fee. The rest goes to the Agency.
        const masterAdminFeeCents = baseFee * 100;
        
        // Ensure the total amount is greater than the master fee to avoid Stripe errors
        if (amountInCents > masterAdminFeeCents) {
          // Stripe Connect Destination Charge for Subscriptions
          // We transfer the funds to the Agency's connected account, and keep the application_fee_percent for the platform.
          // Since application_fee_percent is a percentage, we calculate what % the master fee is.
          const feePercent = (masterAdminFeeCents / amountInCents) * 100;
          
          params.append('subscription_data[application_fee_percent]', feePercent.toFixed(2));
          params.append('subscription_data[transfer_data][destination]', tenant.agency.stripe_account_id);
        }
      }

      const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      const session = await stripeResponse.json();

      if (session.error) {
        throw new Error(session.error.message);
      }

      return NextResponse.json({ url: session.url });

    } else if (gateway === 'paymob') {
      // Paymob implementation would go here (Authentication -> Order Registration -> Payment Key Request)
      // Since Paymob flow is multi-step, we return a placeholder for now.
      return NextResponse.json({ error: 'Paymob gateway integration is pending.' }, { status: 501 });
    }

    return NextResponse.json({ error: 'Invalid gateway' }, { status: 400 });

  } catch (error) {
    console.error('[CHECKOUT ERROR]', error);
    return NextResponse.json({ error: 'Unable to create checkout session.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { KMS } from '@/lib/kms';

// Create a Supabase client with the SERVICE ROLE KEY to bypass RLS for background webhooks
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy'
);

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe signature' }, { status: 400 });
    }

    // 1. Fetch Stripe Webhook Secret
    let stripeSecret = await KMS.getSecret('STRIPE_SECRET_KEY');
    let webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    if (!webhookSecret) {
      const { data: platformSettings } = await supabaseAdmin.from('platform_settings').select('stripe_webhook_secret').limit(1).single();
      if (platformSettings?.stripe_webhook_secret) {
        webhookSecret = platformSettings.stripe_webhook_secret;
      }
    }

    if (!stripeSecret || !webhookSecret) {
      console.error('[FINANCE ERROR] Missing Master Stripe secrets for webhook verification.');
      return NextResponse.json({ error: 'Webhook configuration missing' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecret, { apiVersion: '2026-04-22.dahlia' as any });

    // 2. Verify Signature SECURELY using Stripe SDK (Must be done FIRST)
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      console.error('[FINANCE FRAUD ALERT] Webhook signature verification failed.', err.message);
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
    }

    // 3. Now it is safe to extract tenantId from the verified event object
    const rawTenantId = event.data.object.client_reference_id || (event.data.object as any).metadata?.tenantId;

    if (!rawTenantId) {
      return NextResponse.json({ received: true, note: 'No client_reference_id found' });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof rawTenantId !== 'string' || !uuidRegex.test(rawTenantId)) {
      console.warn(`[SECURITY ALERT] Invalid tenantId format received in webhook`);
      return NextResponse.json({ error: 'Invalid tenant format' }, { status: 400 });
    }
    const tenantId = rawTenantId;

    // 4. Fetch Tenant to find which Agency owns them
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('*, agency:agencies(*)')
      .eq('id', tenantId)
      .single();

    if (!tenant) {
      console.error(`[FINANCE ERROR] Tenant not found for webhook: ${tenantId}`);
      return NextResponse.json({ error: 'Tenant not found for this webhook' }, { status: 404 });
    }

    // 5. Handle the payment success event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const stripeInvoiceId = session.invoice?.toString() || session.id;

      // IDEMPOTENCY CHECK: Prevent Replay Attacks
      const { data: existingInvoice } = await supabaseAdmin
        .from('invoices')
        .select('id')
        .eq('stripe_invoice_id', stripeInvoiceId)
        .single();
        
      if (existingInvoice) {
        console.log(`[FINANCE] Webhook ignored: Invoice ${stripeInvoiceId} already processed (Idempotency).`);
        return NextResponse.json({ received: true, note: 'Already processed' });
      }
      
      // Calculate new expiration date (+30 days)
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);
      
      const purchasedPlan = session.metadata?.planId || 'pro'; // Dynamic tier assignment

      // Update tenant status in Database
      const { error: updateError } = await supabaseAdmin
        .from('tenants')
        .update({
          subscription_tier: purchasedPlan,
          status: 'active',
          trial_ends_at: expirationDate.toISOString()
        })
        .eq('id', tenantId);

      if (updateError) {
        console.error('[FINANCE DB ERROR] Failed to update tenant status:', updateError);
        throw updateError;
      }

      // Generate Invoice Record for Tax Compliance
      await supabaseAdmin
        .from('invoices')
        .insert([{
          tenant_id: tenantId,
          amount: (session.amount_total || 0) / 100, // convert cents to dollars
          currency: session.currency || 'usd',
          status: 'paid',
          stripe_invoice_id: stripeInvoiceId
        }]);

      console.log(`[FINANCE SUCCESS] Tenant ${tenantId} successfully upgraded to ${purchasedPlan.toUpperCase()}. Invoice generated. Funds routed to: ${tenant.agency ? 'Agency' : 'Master Admin'}`);
    }

    // 6. Handle Cancellations & Refunds
    if (event.type === 'customer.subscription.deleted' || event.type === 'charge.refunded') {
      const { error: suspendError } = await supabaseAdmin
        .from('tenants')
        .update({ status: 'suspended' })
        .eq('id', tenantId);

      if (suspendError) {
        console.error('[FINANCE CRITICAL] Failed to suspend tenant after refund/cancellation:', suspendError);
      } else {
        console.log(`[FINANCE ALARM] Tenant ${tenantId} suspended due to cancellation or refund.`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[WEBHOOK CRITICAL ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

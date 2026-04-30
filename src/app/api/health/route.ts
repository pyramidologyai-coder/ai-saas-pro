import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel Edge caching - prevent caching for health checks
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const startTime = Date.now();
    let dbStatus = 'healthy';
    let metaStatus = 'healthy';
    
    // 1. Check Database Health
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        );
        // A lightweight ping query
        const { error } = await supabase.from('platform_settings').select('id').limit(1);
        if (error) throw error;
    } catch (e) {
        dbStatus = 'degraded';
        console.error('[HEALTH] DB Ping Failed', e);
    }

    // 2. Check Meta/WhatsApp API Health (Graph API Ping)
    try {
        const res = await fetch('https://graph.facebook.com/v19.0/', { method: 'GET' });
        // It will return an error JSON because we didn't pass a token, but as long as we get a 200 or 400 (not a 5xx timeout), Meta is alive.
        if (res.status >= 500) {
            metaStatus = 'degraded';
        }
    } catch (e) {
        metaStatus = 'degraded';
        console.error('[HEALTH] Meta API Ping Failed', e);
    }

    const latency = Date.now() - startTime;
    const overallStatus = (dbStatus === 'healthy' && metaStatus === 'healthy') ? 'ok' : 'degraded';

    return NextResponse.json({
        status: overallStatus,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        latency_ms: latency,
        services: {
            database: dbStatus,
            redis_queue: 'healthy', // Mocked for now since we use in-memory queue fallback
            whatsapp_graph_api: metaStatus
        },
        version: '2.0.0-Beta'
    }, { 
        status: overallStatus === 'ok' ? 200 : 503 
    });
}

import { serve } from 'https://deno.land/std/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 })
  }

  let notification_id: string
  try {
    const body = await req.json()
    notification_id = body.notification_id
    if (!notification_id) throw new Error()
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: notification } = await supabase
    .from('notifications')
    .select('*, tenants(user_id, name)')
    .eq('id', notification_id)
    .eq('email_sent', false)
    .eq('target_role', 'admin')
    .single()

  if (!notification) {
    return new Response('Not Found', { status: 404 })
  }

  const { data: userData } = await supabase
    .auth.admin
    .getUserById(notification.tenants.user_id)

  if (!userData?.user?.email) {
    return new Response('No Email', { status: 404 })
  }

  const templates: Record<string, { subject: string, color: string, icon: string }> = {
    warning_80: {
      subject: 'تحذير: وصلت 80% من رصيد رسائلك',
      color: '#F59E0B', icon: '⚠️'
    },
    warning_95: {
      subject: 'تحذير عاجل: 95% من رصيد رسائلك',
      color: '#EF4444', icon: '🚨'
    },
    limit_reached: {
      subject: 'انتهى رصيد رسائلك',
      color: '#EF4444', icon: '⛔'
    },
    subscription_expiring: {
      subject: 'اشتراكك على وشك الانتهاء',
      color: '#F59E0B', icon: '📅'
    },
    audio_received: {
      subject: 'رسالة صوتية واردة',
      color: '#3B82F6', icon: '🎵'
    }
  }

  const template = templates[notification.type]

  const emailHtml = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <div style="background: white; border-radius: 12px; padding: 30px; border-top: 4px solid ${template.color};">
        <h1 style="color: ${template.color};">
          ${template.icon} ${template.subject}
        </h1>
        <p style="color: #333; font-size: 16px;">
          ${notification.message}
        </p>
        <a href="${Deno.env.get('NEXT_PUBLIC_APP_URL')}/dashboard" style="display: inline-block; background: ${template.color}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px;">
          اذهب للداشبورد
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          Pyramidology AI
        </p>
      </div>
    </div>
  `

  const emailRes = await fetch(
    'https://api.resend.com/emails',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'no-reply@pyramidology.ai',
        to: userData.user.email,
        subject: template.subject,
        html: emailHtml,
      }),
    }
  )

  if (emailRes.ok) {
    await supabase
      .from('notifications')
      .update({
        email_sent: true,
        email_sent_at: new Date().toISOString()
      })
      .eq('id', notification_id)

    return new Response('OK', { status: 200 })
  }

  return new Response('Email Failed', { status: 500 })
})

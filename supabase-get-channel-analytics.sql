CREATE OR REPLACE FUNCTION public.get_channel_analytics(p_days integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_today bigint;
  v_total_week bigint;
  v_total_month bigint;
  v_total_all bigint;
  v_channels jsonb;
  v_agencies jsonb;
  v_timeline jsonb;
  v_peak_hours jsonb;
BEGIN
  IF NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT count(*) INTO v_total_today 
  FROM public.chat_messages WHERE created_at >= current_date;
  
  SELECT count(*) INTO v_total_week 
  FROM public.chat_messages WHERE created_at >= current_date - interval '7 days';
  
  SELECT count(*) INTO v_total_month 
  FROM public.chat_messages WHERE created_at >= current_date - interval '30 days';
  
  SELECT count(*) INTO v_total_all 
  FROM public.chat_messages;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_channels FROM (
    SELECT LOWER(channel) as channel, count(*) as count
    FROM public.chat_messages
    WHERE created_at >= now() - (p_days || ' days')::interval
    GROUP BY LOWER(channel)
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_agencies FROM (
    SELECT 
      a.id as agency_id,
      a.name as agency_name,
      count(m.id) as count
    FROM public.chat_messages m
    JOIN public.tenants ten ON m.tenant_id = ten.id
    JOIN public.agencies a ON ten.agency_id = a.id
    WHERE m.created_at >= now() - (p_days || ' days')::interval
    GROUP BY a.id, a.name
    ORDER BY count DESC
    LIMIT 10
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_timeline FROM (
    SELECT 
      to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date,
      LOWER(channel) as channel,
      count(*) as count
    FROM public.chat_messages
    WHERE created_at >= now() - (p_days || ' days')::interval
    GROUP BY date_trunc('day', created_at), LOWER(channel)
    ORDER BY date_trunc('day', created_at) ASC
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_peak_hours FROM (
    SELECT 
      extract(hour from created_at)::integer as hour,
      count(*) as count
    FROM public.chat_messages
    WHERE created_at >= now() - (p_days || ' days')::interval
    GROUP BY extract(hour from created_at)
    ORDER BY hour ASC
  ) t;

  RETURN jsonb_build_object(
    'total_today', COALESCE(v_total_today, 0),
    'total_week', COALESCE(v_total_week, 0),
    'total_month', COALESCE(v_total_month, 0),
    'total_all', COALESCE(v_total_all, 0),
    'channels', v_channels,
    'agencies', v_agencies,
    'timeline', v_timeline,
    'peak_hours', v_peak_hours
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_channel_analytics(integer) TO authenticated;

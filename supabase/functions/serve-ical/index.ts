import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const propertyId = url.searchParams.get('propertyId')
    const userId = url.searchParams.get('userId')
    const feedToken = url.searchParams.get('token')

    // Create Supabase client - no auth needed since we verify via feed token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify feed token
    const { data: feedAccess } = await supabaseClient
      .from('ical_feed_access')
      .select('user_id, property_id')
      .eq('token', feedToken)
      .single()

    if (!feedAccess || 
        (feedAccess.user_id !== userId) || 
        (propertyId && feedAccess.property_id !== propertyId)) {
      throw new Error('Invalid feed token')
    }

    // Build query for changeovers
    let query = supabaseClient
      .from('changeovers')
      .select(`
        id,
        checkin_date,
        checkout_date,
        status,
        share_token,
        property:properties (
          id,
          name
        )
      `)
      .order('checkin_date')

    // Filter by property if specified
    if (propertyId) {
      query = query.eq('property_id', propertyId)
    } else {
      // Get all properties the user has access to
      const { data: properties } = await supabaseClient
        .from('properties')
        .select('id')
        .eq('created_by', userId)

      if (!properties?.length) {
        throw new Error('No properties found')
      }

      query = query.in('property_id', properties.map(p => p.id))
    }

    // Get changeovers
    const { data: changeovers, error } = await query
    if (error) throw error

    // Generate iCal content
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Publichouse//Changeover Calendar//EN',
      `X-WR-CALNAME:Publichouse - ${propertyId ? changeovers[0]?.property.name || 'Property' : 'All Properties'}`,
      'X-WR-CALDESC:Changeover schedule and details',
      'CALSCALE:GREGORIAN'
    ]

    for (const changeover of changeovers) {
      // Parse dates as full day events
      const startDate = new Date(changeover.checkin_date + 'T00:00:00')
      const endDate = new Date(changeover.checkout_date + 'T00:00:00')
      const shareUrl = `${Deno.env.get('APP_URL') || 'http://localhost:3000'}/?token=${changeover.share_token}`
      
      lines.push(
        'BEGIN:VEVENT',
        `UID:changeover-${changeover.id}@publichouse`,
        `DTSTAMP:${formatICalDate(new Date())}`,
        `DTSTART;VALUE=DATE:${formatFullDayDate(startDate)}`,
        `DTEND;VALUE=DATE:${formatFullDayDate(endDate)}`,
        `SUMMARY:Changeover at ${changeover.property.name}`,
        `DESCRIPTION:Status: ${changeover.status}\\n\\nView details: ${shareUrl}`,
        `URL:${shareUrl}`,
        'END:VEVENT'
      )
    }

    lines.push('END:VCALENDAR')

    return new Response(lines.join('\r\n'), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar',
        'Content-Disposition': `attachment; filename="publichouse-${propertyId || 'all'}.ics"`
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function formatFullDayDate(date: Date): string {
  return date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0')
}

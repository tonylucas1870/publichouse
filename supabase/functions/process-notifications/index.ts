import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY') as string;
const SENDGRID_FROM_EMAIL = Deno.env.get('SENDGRID_FROM_EMAIL') as string;

async function sendEmail(to: string, subject: string, content: string) {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{
        to: [{ email: to }]
      }],
      from: { email: SENDGRID_FROM_EMAIL },
      subject: subject,
      content: [{
        type: 'text/plain',
        value: content
      }]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`SendGrid API error: ${JSON.stringify(error)}`);
  }

  return response;
}

serve(async (req) => {
  try {
    // Get pending notifications
    const { data: notifications, error: fetchError } = await supabase
      .from('notification_queue')
      .select(`
        id,
        user_id,
        notification_type,
        subject,
        body,
        data,
        attempts
      `)
      .eq('status', 'pending')
      .lt('attempts', 3)
      .order('created_at');

    if (fetchError) throw fetchError;
    if (!notifications?.length) {
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    // Process each notification
    const results = await Promise.all(notifications.map(async (notification) => {
      try {
        // Get user email
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(
          notification.user_id
        );
        if (userError) throw userError;
        if (!user?.email) throw new Error('User email not found');

        // Process template variables
        let subject = notification.subject;
        let body = notification.body;
        
        // Replace variables in templates
        Object.entries(notification.data).forEach(([key, value]) => {
          const pattern = new RegExp(`{{${key}}}`, 'g');
          subject = subject.replace(pattern, value as string);
          body = body.replace(pattern, value as string);
        });

        // Send email using SendGrid
        await sendEmail(user.email, subject, body);

        // Mark as sent
        const { error: updateError } = await supabase
          .from('notification_queue')
          .update({
            status: 'sent',
            processed_at: new Date().toISOString(),
            attempts: notification.attempts + 1
          })
          .eq('id', notification.id);

        if (updateError) throw updateError;
        return { id: notification.id, success: true };
      } catch (error) {
        console.error('Error processing notification:', error);

        // Update attempts count
        await supabase
          .from('notification_queue')
          .update({
            status: notification.attempts >= 2 ? 'failed' : 'pending',
            attempts: notification.attempts + 1,
            last_attempt: new Date().toISOString()
          })
          .eq('id', notification.id);

        return { id: notification.id, success: false, error: error.message };
      }
    }));

    return new Response(
      JSON.stringify({
        processed: results.length,
        succeeded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing notification queue:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
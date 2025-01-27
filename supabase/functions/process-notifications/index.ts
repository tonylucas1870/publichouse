import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const smtp = new SMTPClient({
  connection: {
    hostname: Deno.env.get('SMTP_HOST') as string,
    port: parseInt(Deno.env.get('SMTP_PORT') || '587'),
    tls: true,
    auth: {
      username: Deno.env.get('SMTP_USER') as string,
      password: Deno.env.get('SMTP_PASS') as string,
    },
  },
});

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

        // Send email
        await smtp.send({
          from: Deno.env.get('SMTP_FROM') as string,
          to: user.email,
          subject,
          content: body,
        });

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
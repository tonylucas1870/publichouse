import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { Buffer } from 'https://deno.land/std@0.168.0/node/buffer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Get JWT token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authorization token');
    }

    // Get form data
    const formData = await req.formData();
    const videoFile = formData.get('file') as File;
    const rooms = JSON.parse(formData.get('rooms') as string || '[]');
    const contentItems = JSON.parse(formData.get('contentItems') as string || '[]');

    if (!videoFile) {
      throw new Error('No video file provided');
    }

    console.debug('Analyzing video for changeover', {
      userId: user.id,
      roomCount: rooms.length,
      itemCount: contentItems.length
    });

    // Convert video file to ArrayBuffer
    const arrayBuffer = await videoFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create form data for Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append('file', new Blob([buffer], { type: videoFile.type }), 'video.mov');
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('language', 'en');

    console.debug('Sending video to Whisper API');
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
      },
      body: whisperFormData
    });

    if (!whisperResponse.ok) {
      const error = await whisperResponse.json();
      console.error('Whisper API error:', error);
      throw new Error('Transcription failed: ' + error.error?.message || 'Unknown error');
    }

    const transcript = await whisperResponse.json();
    console.debug('Got transcript from Whisper', {
      length: transcript.text.length,
      preview: transcript.text.substring(0, 100)
    });

    // Analyze transcript with GPT
    const prompt = `
      Given the following context about a property:
      Rooms: ${rooms.map((r: any) => r.name).join(', ')}
      Content Items: ${contentItems.map((i: any) => i.name || i).join(', ')}

      And this transcription of a video about a finding:
      "${transcript.text}"

      Extract the following information:
      1. Which room from the list is being discussed?
      2. Which content item from the list is involved (if any)?
      3. What is the issue or problem being described?

      Return as JSON with these fields: {location, contentItem, description}
      
      Rules:
      - location must exactly match one of the provided room names
      - contentItem must exactly match one of the provided item names
      - description should be clear and concise
    `;

    console.debug('Sending prompt to GPT', {
      promptLength: prompt.length,
      roomCount: rooms.length,
      itemCount: contentItems.length
    });

    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: 'You are an expert at analyzing property inspection videos and matching rooms and items to predefined lists.'
        }, {
          role: 'user',
          content: prompt
        }],
        temperature: 0.3 // Lower temperature for more focused matching
      })
    });

    if (!gptResponse.ok) {
      const error = await gptResponse.json();
      console.error('GPT API error:', error);
      throw new Error('Analysis failed: ' + error.error?.message || 'Unknown error');
    }

    const analysis = await gptResponse.json();
    const result = JSON.parse(analysis.choices[0].message.content);

    console.debug('Analysis complete', {
      location: result.location,
      hasContentItem: !!result.contentItem,
      descriptionLength: result.description.length
    });

    return new Response(
      JSON.stringify({ 
        transcript: transcript.text,
        analysis: result
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error analyzing video:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message.includes('authorization') ? 401 : 500
      }
    );
  }
});
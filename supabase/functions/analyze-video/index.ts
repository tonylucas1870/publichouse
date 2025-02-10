import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { decode } from 'https://deno.land/x/webm@v0.1.5/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Get form data
    const formData = await req.formData();
    const videoFile = formData.get('file');
    const rooms = JSON.parse(formData.get('rooms') as string);
    const contentItems = JSON.parse(formData.get('contentItems') as string);

    if (!videoFile) {
      throw new Error('No video file provided');
    }

    // Extract audio from WebM video
    const videoData = new Uint8Array(await (videoFile as File).arrayBuffer());
    const webm = decode(videoData);
    const audioTrack = webm.tracks.find(t => t.type === 'audio');

    if (!audioTrack) {
      throw new Error('No audio track found in video');
    }

    // Convert audio to WAV format
    const audioData = new Uint8Array(audioTrack.data);
    const wavBlob = new Blob([audioData], { type: 'audio/wav' });

    // Send to Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append('file', wavBlob);
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('language', 'en');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
      },
      body: whisperFormData
    });

    const transcript = await whisperResponse.json();

    // Analyze transcript with GPT
    const prompt = `
      Given the following context about a property:
      Rooms: ${rooms.map((r: any) => r.name).join(', ')}
      Content Items: ${contentItems.map((i: any) => i.name).join(', ')}

      And this transcription of a video about a finding:
      "${transcript.text}"

      Extract the following information:
      1. Which room from the list is being discussed?
      2. Which content item from the list is involved (if any)?
      3. What is the issue or problem being described?

      Return as JSON with these fields: {location, contentItem, description}
    `;

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

    const analysis = await gptResponse.json();
    const result = JSON.parse(analysis.choices[0].message.content);

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
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
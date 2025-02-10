import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { Buffer } from 'https://deno.land/std@0.168.0/node/buffer.ts';
import { inspect } from 'https://deno.land/std@0.168.0/node/util.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Debug logging helper
function debugLog(stage: string, data: any) {
  console.log(`[${stage}] ${inspect(data, { depth: null, colors: true })}`);
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get JWT token
    const authHeader = req.headers.get('Authorization');
    debugLog('Auth Header', { 
      exists: !!authHeader,
      header: authHeader?.substring(0, 20) + '...' // Log first 20 chars for debugging
    });

    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    debugLog('Auth Check', {
      success: !!user && !authError,
      userId: user?.id,
      error: authError
    });

    if (authError || !user) {
      throw new Error('Invalid authorization token');
    }

    // Get form data
    const formData = await req.formData();
    const videoFile = formData.get('file') as File;
    const rooms = JSON.parse(formData.get('rooms') as string || '[]');
    const contentItems = JSON.parse(formData.get('contentItems') as string || '[]');

    debugLog('Request Data', {
      hasVideo: !!videoFile,
      videoType: videoFile?.type,
      videoName: videoFile?.name,
      videoSize: videoFile?.size,
      videoHeaders: Object.fromEntries(videoFile?.stream?.getHeaders?.() || []),
      roomCount: rooms.length,
      itemCount: contentItems.length
    });

    // Get correct MIME type based on file extension
    const getVideoMimeType = (filename: string) => {
      const ext = filename.split('.').pop()?.toLowerCase();
      const mimeTypes = {
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mov': 'video/mp4', // Convert MOV to MP4
        'm4a': 'audio/mp4',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav'
      };
      return mimeTypes[ext as keyof typeof mimeTypes] || 'video/mp4';
    };

    // Determine correct MIME type
    const mimeType = getVideoMimeType(videoFile.name);
    debugLog('MIME Type', {
      original: videoFile.type,
      determined: mimeType,
      filename: videoFile.name
    });
    }

    console.debug('Analyzing video', {
      userId: user.id,
      roomCount: rooms.length,
      itemCount: contentItems.length,
      videoType: mimeType,
      originalType: videoFile.type
    });

    // Convert video file to ArrayBuffer
    const arrayBuffer = await videoFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    debugLog('Video Buffer', {
      size: buffer.length,
      preview: buffer.slice(0, 50), // First 50 bytes for format checking
      originalMimeType: videoFile.type,
      newMimeType: mimeType
    });

    // Get file extension from MIME type
    const fileExt = '.' + mimeType.split('/')[1];

    // Create form data for Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append('file', new Blob([buffer], { type: mimeType }), `audio${fileExt}`);
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('language', 'en');

    debugLog('Whisper Request', {
      blobSize: new Blob([buffer]).size,
      mimeType: mimeType,
      fileName: `audio${fileExt}`,
      model: 'whisper-1'
    });

    console.debug('Sending video to Whisper API');
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
      },
      body: whisperFormData
    });

    debugLog('Whisper Response', {
      status: whisperResponse.status,
      statusText: whisperResponse.statusText,
      headers: Object.fromEntries(whisperResponse.headers.entries())
    });

    if (!whisperResponse.ok) {
      const error = await whisperResponse.json();
      debugLog('Whisper Error', error);
      console.error('Whisper API error:', error);
      throw new Error('Transcription failed: ' + (error.error?.message || 'Unknown error'));
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

    debugLog('GPT Request', {
      model: 'gpt-4',
      promptLength: prompt.length,
      roomCount: rooms.length,
      itemCount: contentItems.length,
      transcriptLength: transcript.text.length
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

    debugLog('GPT Response', {
      status: gptResponse.status,
      statusText: gptResponse.statusText,
      headers: Object.fromEntries(gptResponse.headers.entries())
    });

    if (!gptResponse.ok) {
      const error = await gptResponse.json();
      debugLog('GPT Error', error);
      console.error('GPT API error:', error);
      throw new Error('Analysis failed: ' + (error.error?.message || 'Unknown error'));
    }

    const analysis = await gptResponse.json();
    const result = JSON.parse(analysis.choices[0].message.content);

    debugLog('Analysis Result', {
      raw: analysis.choices[0].message.content,
      parsed: result,
      matchedRoom: rooms.some((r: any) => r.name === result.location),
      matchedItem: contentItems.some((i: any) => (i.name || i) === result.contentItem)
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
    debugLog('Error', {
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
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
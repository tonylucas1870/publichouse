import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

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
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get request body
    const { listingData, propertyId } = await req.json();
    if (!listingData || !propertyId) {
      throw new Error('Listing data and property ID are required');
    }

    console.debug('Analyzing listing data:', { 
      id: listingData.id,
      name: listingData.name,
      propertyId
    });

    // Get existing rooms and contents
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select(`
        id,
        name,
        room_details (
          contents
        )
      `)
      .eq('property_id', propertyId);

    if (roomsError) throw roomsError;

    // Format existing data for GPT context
    const existingRooms = rooms?.map(room => ({
      name: room.name,
      contents: room.room_details?.contents || []
    })) || [];

    console.debug('Got existing property data:', {
      roomCount: existingRooms.length,
      rooms: existingRooms.map(r => ({
        name: r.name,
        contentCount: r.contents.length
      }))
    });

    // Call OpenAI API to analyze listing
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `
      Analyze this Airbnb listing data and extract room and content information.
      Create a structured list of rooms and their contents based on the description,
      amenities, and other details provided.

      IMPORTANT: The property may already have some rooms and contents configured.
      You must:
      1. Preserve existing rooms and their contents
      2. Add new rooms that don't exist
      3. Add new contents to existing rooms if they're different items
      4. DO NOT duplicate existing items in the same room
      5. If a similar item exists in a different room, treat it as a new item

      Existing Property Configuration:
      ${JSON.stringify(existingRooms, null, 2)}

      Rules:
      1. Each room should have:
         - name (standard room names like "Living Room", "Kitchen", etc)
         - contents (list of furniture and items in that room)
      2. Each content item should have:
         - name (clear, descriptive name)
         - description (brief description including key details)
      3. Focus on permanent fixtures and furniture, not consumables or small items
      4. Group similar items together (e.g. "Dining Chairs" instead of listing each chair).  If possible add a count e.g 6 Dining Chairs rather than just specifying multiple items.
      5. Use standard room names that match common property management categories
      6. Include any special features or high-value items mentioned
      7. Note any smart home or electronic devices

      Listing Data:
      ${JSON.stringify(listingData, null, 2)}

      If it is possible to ascertain either through design, listed modal or serial numbers, or any other identifying items, a closer detailed description of an item, e.g a specific size, model, colour, edition then you should do so, but only if confident, otherwise stick with a broader description.
      Return as JSON with this structure:
      {
        "rooms": [{
          "name": string,
          "contents": [{
            "name": string,
            "description": string
          }],
          "isNew": boolean,
          "hasNewContents": boolean
        }]
      }

      Include "isNew" flag for each room to indicate if it's a new room,
      and "hasNewContents" to indicate if any new contents were added to an existing room.
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: 'You are an expert at analyzing property listings and identifying rooms and contents while preserving existing configurations.'
        }, {
          role: 'user',
          content: prompt
        }],
        temperature: 0.3 // Lower temperature for more focused output
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const analysis = await response.json();
    const result = JSON.parse(analysis.choices[0].message.content);

    console.debug('Analysis complete', {
      roomCount: result.rooms.length,
      rooms: result.rooms.map(r => ({
        name: r.name,
        contentCount: r.contents.length,
        isNew: r.isNew,
        hasNewContents: r.hasNewContents
      }))
    });

    // Validate result structure
    if (!Array.isArray(result.rooms)) {
      throw new Error('Invalid analysis result: rooms must be an array');
    }

    for (const room of result.rooms) {
      if (!room.name || !Array.isArray(room.contents)) {
        throw new Error('Invalid room structure in analysis result');
      }
      for (const item of room.contents) {
        if (!item.name || !item.description) {
          throw new Error('Invalid content item structure in analysis result');
        }
      }
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Airbnb analysis error:', error);

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
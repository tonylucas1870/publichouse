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


//Define the prompt for the developer
const developerPrompt = `You are an expert at analyzing property listings and identifying rooms and contents.
      Your task is to extract structured information about rooms, furniture, fixtures, and other property details from a combination of a detailed description and a set of images.
      Follow these strict rules to ensure accuracy and completeness:
      
      General Rules
	1.	Preserve existing rooms and their contents from previous extractions.
	2.	Identify and add new rooms if they are found in the description or images but do not already exist. Where bedrooms have en-suites, include them as part of the description for that room, including their facilities e.g the room should have a toilet/shower etc.
	3.	Add new items to existing rooms only if they are different from already-listed items.
	4.	DO NOT duplicate items in the same room.
	5.	If a similar item appears in a different room, treat it as a new item and assign it to that specific room.
	6.	Treat duplicate rooms individually EXCEPT for en-suite bathrooms, which must remain part of their corresponding bedroom and be listed under its "contents".
	7.	Include en-suite bathrooms in the respective bedroom descriptions, listing all their facilities separately.
	8.	DO NOT group unrelated items together. For example:
	•	Correct: “Toilet”, “Sink”, “Shower” (as separate items)
	•	Incorrect: “Bathroom suite”
  
  Item Categorization & Naming Rules
	9.	List items explicitly and separately instead of generalizing them (e.g., list “Dining Table” and “Dining Chairs” separately).
	10.	If multiple identical items exist, such as bedside tables or lamps, list them as a single item with a count (e.g., “Bedside Table (2)”).
	11.	Identify seating areas explicitly. Do not generalize—list each chair, sofa, or bench separately with a count.
	12.	Use standard room names (e.g., “Living Room”, “Kitchen”, “Bathroom”). If an unnamed space is identified, assign the most appropriate name based on its function.
	13.	Group the same type of items together within one room (e.g., “Dining Chairs (8)” instead of listing each chair separately).
  
  Data Structure Rules
	14.	Each room must contain:

	•	"name" → (e.g., "Kitchen", "Bedroom 1", "Bathroom 2")
	•	"contents" → A list of items found in that room
  If the room has an en-suite bathroom, list its fixtures under "contents", instead of creating a separate "Bathroom" entry.

	15.	Each item within a room must contain:

	•	"name" → A clear, descriptive name (e.g., "King-Size Bed", "Dining Table", "Toilet")
	•	"description" → A concise description including key attributes (e.g., "Super-king-size zip-and-link bed that can be split into two single beds")
	•	"source" → "image" if identified from images, "description" if identified from text

  Formatting & Constraints
	16.	DO NOT use adjectives like “comfortable,” “spacious,” or “homely.” Only list factual items.
	17.	DO NOT include explanatory text or markdown formatting—return only structured JSON data.
	18.	Each extracted item must be clearly marked with whether it was identified from an image or the description, using the "source" flag.
	19.	DO NOT summarize or infer missing details. Only list what is explicitly visible in the images or mentioned in the description.
  `;

const response_format = 
{
        "type": "json_schema",
        "json_schema": {
            "name": "property_data_extraction",
            "schema": {
                "type": "object",
                "title": "Property Room Breakdown",
                "description": "Schema defining the structure for room furniture and appliances breakdown.",
                "properties": {
                    "property": {
                        "type": "string",
                        "description": "Name or ID of the property"
                    },
                    "rooms": {
                        "type": "array",
                        "description": "List of rooms in the property with their furniture and appliances",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {
                                    "type": "string",
                                    "description": "Room name"
                                },
                                "isNew": {
                                    "type": "boolean",
                                    "description": "Flag indicating if this is a new room"
                                },
                                "type": {
                                    "type": "string",
                                    "description": "Room category (e.g., 'bedroom', 'living_room', 'kitchen', 'bathroom', 'outdoor')",
                                    "enum": [
                                        "bedroom",
                                        "living_room",
                                        "kitchen",
                                        "bathroom",
                                        "utility",
                                        "outdoor",
                                        "dining_room",
                                        "office",
                                        "other"
                                    ]
                                },
                                "contents": {
                                    "type": "array",
                                    "description": "List of furniture, fixtures and appliances in the room",
                                    "items": {
                                        "type": "object",
                                        "is_new": {
                                            "type": "boolean",
                                            "description": "Flag indicating if this is a newly found item"
                                        },
                                        "recognized_by": {
                                            "type": "string",
                                            "description": "Method used to identify the item (e.g., 'image', 'description')"
                                        },
                                        "properties": {
                                            "name": {
                                                "type": "string",
                                                "description": "Furniture or appliance name"
                                            },
                                            "category": {
                                                "type": "string",
                                                "description": "Category of the item (e.g., 'furniture', 'appliance')",
                                                "enum": [
                                                    "furniture",
                                                    "appliance",
                                                    "fixture",
                                                    "other"
                                                ]
                                            },
                                            "quantity": {
                                                "type": "integer",
                                                "description": "Number of this item in the room",
                                                "minimum": 1,
                                                "default": 1
                                            }
                                        },
                                        "required": [
                                            "name",
                                            "category"
                                        ]
                                    }
                                }
                            },
                            "required": [
                                "name",
                                "type",
                                "contents"
                            ]
                        }
                    }
                },
                "required": [
                    "property",
                    "rooms"
                ]
            }
        }
      }

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
    const { listingData: listingDataStr, propertyId } = await req.json();
    if (!listingData || !propertyId) {
      throw new Error('Listing data and property ID are required');
    }
    const listingData = JSON.parse(listingDataStr);
    const listingImages = listingData.images || [];
    console.debug("Listing Data Type:", typeof listingData);
    console.debug(listingData);
    console.debug('Got listing data:', {
      propertyId,
      imageCount: listingImages.length
    }

    )
    // Transform listingImages to GPT content format
    const images = listingImages.map(image => ({
      type: "image_url",
      image_url: {
        url: image.imageUrl
      }
    }));
    console.debug('Got listing images:', {
      imageCount: images.length
    });
    console.debug('Image Data:', images);
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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
       'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
        {
          role: 'developer',
          content: [
            { 
              "type": "text",
              "text": 'You are a JSON-only response bot. You must return only valid JSON without any additional text or formatting.'
            },
            {
              "type": "text",
              "text": developerPrompt
            }
          ]
        },
        {
          role: 'user',
          content: images
        },
        {
          role: 'user',
          content: [
            {
            "type": "text",
            "text": JSON.stringify(listingData)
          },
          {
          "type": "text",
          "text": JSON.stringify(existingRooms)
          }
          ],
        }
      ],
        temperature: 0.3, // Lower temperature for more focused output
        response_format: response_format // Force JSON response
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const gptResponse = await response.json();
    console.debug('Got GPT response:', {
      content: gptResponse.choices[0].message.content.substring(0, 100) + '...'
    });

    let result;
    try {
      // Parse the response content as JSON
      result = JSON.parse(gptResponse.choices[0].message.content);
    } catch (parseError) {
      console.error('Error parsing GPT response:', parseError);
      throw new Error('Invalid JSON response from analysis');
    }

    console.debug('Analysis complete', {
      roomCount: result.rooms.length,
      rooms: result.rooms.map(r => ({
        name: r.name,
        contentCount: r.contents.length,
        isNew: r.isNew,
        hasNewContents: r.hasNewContents
      }))
    });

   /* // Validate result structure
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
*/
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
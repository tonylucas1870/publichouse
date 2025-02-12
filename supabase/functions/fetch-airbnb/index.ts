import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { ApifyClient } from 'https://esm.sh/apify-client@2.8.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

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
    const { url } = await req.json();
    if (!url) {
      throw new Error('No listing URL provided');
    }

    console.debug('Fetching Airbnb listing:', { url });

    // Initialize Apify client
    const client = new ApifyClient({
      token: Deno.env.get('APIFY_API_KEY')
    });

    // Prepare Actor input
    const input = {
      startUrls: [{ url }],
      locale: 'en-US',
      currency: 'USD'
    };

    // Run the Actor and wait for it to finish
    const run = await client.actor('OIYrZy1OpUEgIMYmh').call(input);

    // Get results from dataset
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    const listing = items[0];

    if (!listing) {
      throw new Error('No listing data found');
    }

    // Extract relevant details
    const details = {
      id: listing.id,
      name: listing.name,
      description: listing.description,
      roomType: listing.roomType,
      propertyType: listing.propertyType,
      capacity: {
        guests: listing.maxGuests,
        bedrooms: listing.bedrooms,
        beds: listing.beds,
        bathrooms: listing.bathrooms
      },
      amenities: listing.amenities,
      location: {
        address: listing.address,
        city: listing.city,
        state: listing.state,
        country: listing.country,
        lat: listing.lat,
        lng: listing.lng
      },
      images: listing.images,
      rating: listing.rating,
      reviewsCount: listing.reviewsCount,
      url: listing.url
    };

    console.debug('Listing fetch successful', {
      id: details.id,
      name: details.name
    });

    return new Response(
      JSON.stringify(details),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Airbnb fetch error:', error);
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
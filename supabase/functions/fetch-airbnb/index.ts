import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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

    // Verify Apify API key
    const apifyApiKey = Deno.env.get('APIFY_API_KEY');
    if (!apifyApiKey) {
      throw new Error('Apify API key not configured');
    }

    try {
      // Prepare request to Apify API
      const input = {
        startUrls: [{ url }],
        locale: 'en-US',
        currency: 'USD'
      };

      console.debug('Starting Apify API request');

      // Call Apify API directly
      const response = await fetch('https://api.apify.com/v2/acts/OIYrZy1OpUEgIMYmh/runs?token=' + apifyApiKey, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startUrls: [{ url }],
          locale: 'en-US',
          currency: 'USD'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Apify API error: ${error.message || response.statusText}`);
      }

      const runData = await response.json();
      console.debug('Actor run started', { 
        runId: runData.data.id,
        status: runData.data.status
      });

      // Wait for run to finish and get dataset items
      const datasetId = runData.data.defaultDatasetId;
      let listing = null;
      let attempts = 0;
      const maxAttempts = 30;
      const delay = 2000;

      while (attempts < maxAttempts) {
        // Check run status
        const statusResponse = await fetch(
          `https://api.apify.com/v2/actor-runs/${runData.data.id}?token=${apifyApiKey}`
        );
        const statusData = await statusResponse.json();

        if (statusData.data.status === 'SUCCEEDED') {
          // Get dataset items
          const datasetResponse = await fetch(
            `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyApiKey}`
          );
          const items = await datasetResponse.json();
          
          if (items && items.length > 0) {
            listing = items[0];
            break;
          }
        } else if (statusData.data.status === 'FAILED') {
          throw new Error('Apify actor run failed');
        }

        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (!listing) {
        throw new Error('No listing data found after maximum attempts');
      }

      console.debug('Got listing data', {
        id: listing.id,
        name: listing.name
      });

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

      return new Response(
        JSON.stringify(details),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    } catch (apifyError) {
      console.error('Apify API error:', apifyError);
      throw new Error(`Apify API error: ${apifyError.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Airbnb fetch error:', error);

    // Determine appropriate status code
    let status = 500;
    if (error.message.includes('authorization')) {
      status = 401;
    } else if (error.message.includes('API key')) {
      status = 503; // Service unavailable due to missing configuration
    } else if (error.message.includes('No listing')) {
      status = 404;
    }

    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status
      }
    );
  }
});
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const apiKey = process.env.GOOGLE_MAPS_API_KEY;
if (!apiKey) {
  console.error("⚠️ WARNING: GOOGLE_MAPS_API_KEY environment variable is not configured.");
}

const serverApiKey = process.env.SERVER_API_KEY || process.env.GEMINI_API_KEY || apiKey;


// Simulated weather service for real-world tailormade suggestions
function simulateWeather(location) {
  const hash = location.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const conditions = ["Sunny", "Rainy", "Cloudy", "Windy", "Partly Cloudy", "Mild"];
  const condition = conditions[hash % conditions.length];
  const temperature = 15 + (hash % 15); // 15 to 30 C
  return {
    location,
    condition,
    temperature: `${temperature}°C`,
    humidity: `${50 + (hash % 30)}%`,
    wind: `${5 + (hash % 20)} km/h`
  };
}

// Places API (New) Text Search
async function searchPlacesReal(textQuery, locationBias) {
  try {
    const url = 'https://places.googleapis.com/v1/places:searchText';
    const headers = {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.iconBackgroundColor'
    };
    const body = { textQuery };
    if (locationBias) {
      body.locationBias = {
        circle: {
          center: {
            latitude: locationBias.latitude,
            longitude: locationBias.longitude
          },
          radius: 5000.0
        }
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return data.places || [];
  } catch (err) {
    console.error("Error inside searchPlacesReal:", err);
    return [];
  }
}

// Directions API Route Calculation
async function computeRoutesReal(origin, destination, travelMode = 'DRIVE') {
  try {
    const mode = travelMode.toLowerCase();
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${mode}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];
      return {
        distance: leg.distance.text,
        duration: leg.duration.text,
        startAddress: leg.start_address,
        endAddress: leg.end_address,
        startLocation: leg.start_location,
        endLocation: leg.end_location,
        polyline: route.overview_polyline.points
      };
    }
    return { error: data.error_message || `Directions failed with status ${data.status}` };
  } catch (err) {
    console.error("Error inside computeRoutesReal:", err);
    return { error: err.message };
  }
}

// Conversational Endpoint using official Google Gen AI SDK
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).send({ error: 'Message is required.' });
  }

  // Setup Server-Sent Events headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const sendSSE = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Dynamic import to prevent syntax error on platforms or ESM bundling
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: serverApiKey });

    // Define tools schema for Gemini 2.5
    const searchPlacesDeclaration = {
      name: 'search_places',
      description: 'Searches Google Maps Platform for real-world places, businesses, and landmarks based on a text query.',
      parameters: {
        type: 'OBJECT',
        properties: {
          textQuery: { type: 'STRING', description: 'The search query (e.g. "coffee in Las Vegas", "space needle")' },
          locationBias: {
            type: 'OBJECT',
            description: 'Optional center bias for nearby results',
            properties: {
              latitude: { type: 'NUMBER' },
              longitude: { type: 'NUMBER' }
            },
            required: ['latitude', 'longitude']
          }
        },
        required: ['textQuery']
      }
    };

    const computeRoutesDeclaration = {
      name: 'compute_routes',
      description: 'Calculates driving, walking, or transit directions and estimates travel time/distance between coordinates or addresses.',
      parameters: {
        type: 'OBJECT',
        properties: {
          origin: { type: 'STRING', description: 'Origin address, place name, or "lat,lng" coordinates' },
          destination: { type: 'STRING', description: 'Destination address, place name, or "lat,lng" coordinates' },
          travelMode: { type: 'STRING', enum: ['DRIVE', 'WALK', 'BICYCLE', 'TRANSIT'], description: 'Mode of transit. Defaults to DRIVE.' }
        },
        required: ['origin', 'destination']
      }
    };

    const lookupWeatherDeclaration = {
      name: 'lookup_weather',
      description: 'Retrieves current weather status and temperatures for a location to tailor suggestions (e.g. recommend indoor spots when rainy).',
      parameters: {
        type: 'OBJECT',
        properties: {
          location: { type: 'STRING', description: 'City name or address' }
        },
        required: ['location']
      }
    };

    const systemInstruction = `You are a helpful, expert geospatial assistant named 'Grounding Lite API'.
Your goal is to assist users in discovering places, comparing weather conditions, and plotting routes.
You drive a visual 3D Cesium Map. When you call a tool:
1. 'search_places': We will render numbered pins on the map matching the places returned.
2. 'compute_routes': We will draw a ground-clamped polyline route snapping to roads.

You MUST use 0-based indexing in brackets (e.g., [0], [1], [2]) when referencing places returned from the tool in your responses so the user can easily click them to fly the camera. This index MUST reset to [0] on every new user turn.`;

    const chatSession = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: [searchPlacesDeclaration, computeRoutesDeclaration, lookupWeatherDeclaration] }]
      },
      history: history || []
    });

    sendSSE('status', 'Thinking...');
    let result = await chatSession.sendMessage({ message });

    // Handle tool call loops
    let maxIterations = 5;
    while (result.functionCalls && result.functionCalls.length > 0 && maxIterations > 0) {
      maxIterations--;
      const functionCall = result.functionCalls[0];
      const { name, args } = functionCall;

      if (name === 'search_places') {
        sendSSE('status', `Searching for "${args.textQuery}"...`);
        const places = await searchPlacesReal(args.textQuery, args.locationBias);
        
        // If we found places, tell the frontend to update the map markers
        if (places.length > 0) {
          sendSSE('action', { type: 'addMarkers', places });
        }
        
        result = await chatSession.sendMessage({
          message: [{
            functionResponse: {
              name,
              response: { places }
            }
          }]
        });
      } else if (name === 'compute_routes') {
        sendSSE('status', `Calculating route from ${args.origin} to ${args.destination}...`);
        const routeData = await computeRoutesReal(args.origin, args.destination, args.travelMode);
        
        // Tell the frontend to draw the route path
        if (!routeData.error) {
          sendSSE('action', { type: 'drawRoute', route: routeData });
        }
        
        result = await chatSession.sendMessage({
          message: [{
            functionResponse: {
              name,
              response: { route: routeData }
            }
          }]
        });
      } else if (name === 'lookup_weather') {
        sendSSE('status', `Checking weather for ${args.location}...`);
        const weather = simulateWeather(args.location);
        
        result = await chatSession.sendMessage({
          message: [{
            functionResponse: {
              name,
              response: { weather }
            }
          }]
        });
      }
    }

    // Stream final text tokens
    sendSSE('status', 'Responding...');
    if (result.text) {
      // In non-streaming SDK method, we send the entire text block at once.
      // Since it's ready, send it in a single stream block to be fast and reliable.
      sendSSE('text', result.text);
    }
    
    sendSSE('done', { history: await chatSession.getHistory() });
  } catch (error) {
    console.error("Chat service error:", error);
    sendSSE('error', error.message || 'Conversational turn failed.');
  } finally {
    res.end();
  }
});

// Server-side Geocoder endpoint
app.post('/api/searchPlaces', async (req, res) => {
  const { query, locationBias } = req.body;
  if (!query) {
    return res.status(400).send({ error: 'Query is required.' });
  }
  try {
    const places = await searchPlacesReal(query, locationBias);
    if (places && places.length > 0) {
      res.json(places[0]);
    } else {
      res.status(404).send({ error: 'Place not found.' });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// Expose configuration variables like Google Maps API Key safely to the client
app.get('/api/config', (req, res) => {
  res.json({ apiKey: process.env.GOOGLE_MAPS_API_KEY });
});

// Serve static assets from our compiled dist folder (production React app) and fallback to root
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Spatial Operations Agentic server running on http://localhost:${PORT}`);
});

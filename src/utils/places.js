// Copyright 2026 Google LLC
// Licensed under the Apache License, Version 2.0 (the "License");

let placesService = null;
let placesPromise = null;

/**
 * Asynchronously initializes and loads the Google Maps JavaScript API.
 * Pulls the API key dynamically from our Express config endpoint.
 */
export async function initGoogleMaps() {
  if (placesPromise) return placesPromise;

  placesPromise = (async () => {
    if (window.google && window.google.maps && window.google.maps.importLibrary) {
      return window.google;
    }

    try {
      const res = await fetch('/api/config');
      const config = await res.json();
      const apiKey = config.apiKey;

      if (!apiKey) {
        throw new Error("Google Maps API Key is missing in the configuration.");
      }

      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.type = "text/javascript";
        
        // Google Maps Loader
        script.innerText = ((g) => {
          var h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b = window;
          b = b[c] || (b[c] = {});
          var d = b.maps || (b.maps = {}), r = new Set, e = new URLSearchParams, u = () => h || (h = new Promise(async (f, n) => {
            await (a = m.createElement("script"));
            e.set("libraries", [...r] + "");
            for (k in g) e.set(k.replace(/[A-Z]/g, t => "_" + t[0].toLowerCase()), g[k]);
            e.set("callback", c + ".maps." + q);
            a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
            d[q] = f;
            a.onerror = () => h = n(Error(p + " could not load."));
            a.nonce = m.querySelector("script[nonce]")?.nonce || "";
            m.head.append(a);
          }));
          d[l] ? console.warn(p + " only loads once. Ignoring:", g) : d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n));
        })({
          key: apiKey,
          v: "weekly",
        });

        document.head.appendChild(script);

        // Periodically poll for the importLibrary to be successfully mounted
        const checkInterval = setInterval(() => {
          if (window.google && window.google.maps && window.google.maps.importLibrary) {
            clearInterval(checkInterval);
            
            // Import places library
            window.google.maps.importLibrary("places").then(() => {
              try {
                placesService = new window.google.maps.places.PlacesService(
                  document.createElement("div")
                );
              } catch (err) {
                console.warn("⚠️ Legacy PlacesService initialization failed/skipped. Google Places (new) API will be used instead. Error details:", err.message || err);
              }
              resolve(window.google);
            }).catch((err) => {
              console.error("❌ FATAL: Failed to import 'places' library in Google Places (new) API. Error details:", err.message || err, err.stack || err);
              reject(err);
            });
          }
        }, 50);
      });
    } catch (err) {
      console.error("❌ FATAL: Failed to load Google Maps / Google Places (new) API SDK. Error details:", err.message || err, err.stack || err);
      throw err;
    }
  })();

  return placesPromise;
}

/**
 * Returns details for a given place ID using Google Places (new) API with fallback.
 */
export async function getPlaceDetails(placeId) {
  await initGoogleMaps();
  try {
    const { Place } = await google.maps.importLibrary("places");
    const place = new Place({ id: placeId });

    // Fetch fields for compact places details card
    await place.fetchFields({
      fields: [
        "displayName",
        "formattedAddress",
        "rating",
        "userRatingCount",
        "types",
        "websiteURI",
        "nationalPhoneNumber",
        "regularOpeningHours",
        "photos",
        "reviews"
      ]
    });

    const legacyPlace = {
      name: place.displayName || "",
      formatted_address: place.formattedAddress || "",
      rating: place.rating,
      user_ratings_total: place.userRatingCount,
      types: place.types || [],
      website: place.websiteURI || "",
      formatted_phone_number: place.nationalPhoneNumber || "",
      
      photos: place.photos && place.photos.length > 0 ? [{
        getUrl: () => place.photos[0].getURI({ maxWidth: 400, maxHeight: 400 })
      }] : null,
      
      opening_hours: place.regularOpeningHours ? {
        isOpen: () => place.regularOpeningHours.nextOpeningTime !== undefined,
        weekday_text: place.regularOpeningHours.weekdayDescriptions || []
      } : null,
      
      reviews: place.reviews ? place.reviews.map(r => ({
        author_name: r.authorAttribution?.displayName || "Anonymous",
        text: r.text || "",
        rating: r.rating || 5,
        relative_time_description: r.relativePublishTimeDescription || ""
      })) : null
    };

    return legacyPlace;
  } catch (error) {
    console.error("❌ Google Places (new) API: Place.fetchFields failed. Error details:", error.message || error, error.stack || error);
    console.warn("⚠️ Attempting legacy PlacesService.getDetails fallback...");
    if (placesService) {
      return new Promise((resolve, reject) => {
        placesService.getDetails({ placeId }, (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK) {
            resolve(place);
          } else {
            const err = new Error("Failed to get legacy place details: " + status);
            console.error("❌ Legacy Places fallback failed:", err);
            reject(err);
          }
        });
      });
    }
    throw error;
  }
}

/**
 * Maps a list of place types to one of the available local SVG icons.
 */
export function getPoiIconName(types) {
  if (!types || !Array.isArray(types) || types.length === 0) {
    return "store";
  }

  const mappings = [
    { icon: "bank", keywords: ["bank", "finance", "accounting", "atm", "money_lender"] },
    { icon: "bar", keywords: ["bar", "night_club", "pub", "liquor_store", "tavern", "nightlife", "lounge"] },
    { icon: "bus", keywords: ["bus", "transit", "transportation"] },
    { icon: "coffee", keywords: ["coffee", "cafe", "bakery", "donut_shop"] },
    { icon: "doctor", keywords: ["doctor", "hospital", "health", "dentist", "physiotherapist", "pharmacy", "medical", "drugstore", "clinic"] },
    { icon: "flight", keywords: ["flight", "airport", "aviation"] },
    { icon: "movie", keywords: ["movie", "theater", "cinema", "entertainment", "performing_arts"] },
    { icon: "park", keywords: ["park", "zoo", "amusement_park", "aquarium", "museum", "art_gallery", "national_park", "campground", "cemetery", "tourist_attraction"] },
    { icon: "parking", keywords: ["parking", "garage"] },
    { icon: "photo_camera", keywords: ["photo_camera", "viewpoint", "landmark", "historical_landmark", "attraction"] },
    { icon: "restaurant", keywords: ["restaurant", "food", "diner", "meal", "eating", "pizza", "steak", "sushi", "bistro", "buffet", "fast_food", "hamburger"] },
    { icon: "school", keywords: ["school", "university", "college", "library", "education", "academy"] },
    { icon: "supermarket", keywords: ["supermarket", "grocery", "convenience_store", "market"] },
    { icon: "train", keywords: ["train", "subway", "metro", "rail", "station"] },
    { icon: "store", keywords: ["store", "shopping", "mall", "shop", "boutique", "dealer", "retail"] }
  ];

  for (const type of types) {
    const lowerType = type.toLowerCase();
    const directMatch = mappings.find(m => m.icon === lowerType);
    if (directMatch) return directMatch.icon;

    for (const mapping of mappings) {
      if (mapping.keywords.some(keyword => lowerType.includes(keyword))) {
        return mapping.icon;
      }
    }
  }

  return "store";
}

/**
 * Retrieves nearby places using Google Places (new) API searchNearby or legacy fallback.
 */
export async function getNearbyPois(poiConfig, coordinates) {
  await initGoogleMaps();
  try {
    const { Place } = await google.maps.importLibrary("places");
    const placesPromises = [];

    const lat = typeof coordinates.lat === "function" ? coordinates.lat() : coordinates.lat;
    const lng = typeof coordinates.lng === "function" ? coordinates.lng() : coordinates.lng;

    for (const locationType of poiConfig.types) {
      const request = {
        fields: [
          "id",
          "displayName",
          "location",
          "types",
          "iconBackgroundColor"
        ],
        locationRestriction: {
          center: { lat, lng },
          radius: poiConfig.searchRadius || 1000
        },
        includedTypes: [locationType],
        maxResultCount: 20
      };

      const searchPromise = Place.searchNearby(request)
        .then(({ places }) => places || [])
        .catch(err => {
          console.error(`Error searching type ${locationType}:`, err);
          const errString = String(err);
          if (errString.includes("ApiTargetBlockedMapError") || errString.includes("not authorized") || errString.includes("restricted")) {
            throw err;
          }
          return [];
        });

      placesPromises.push(searchPromise);
    }

    const resultsArray = await Promise.all(placesPromises);
    const allPlaces = resultsArray.flat();

    const mappedPlaces = allPlaces.map(place => {
      const iconName = getPoiIconName(place.types);
      const iconBaseUri = `assets/icons/poi/${iconName}`;

      return {
        place_id: place.id,
        name: place.displayName || "",
        geometry: {
          location: place.location
        },
        icon_background_color: place.iconBackgroundColor || "#4f46e5",
        icon_mask_base_uri: iconBaseUri,
        types: place.types || []
      };
    });

    const uniqueMapped = mappedPlaces.reduce((acc, place) => {
      if (!acc.some(p => p.place_id === place.place_id)) {
        acc.push(place);
      }
      return acc;
    }, []);

    return uniqueMapped.slice(0, poiConfig.density);
  } catch (error) {
    console.error("❌ Google Places (new) API: Place.searchNearby failed. Error details:", error.message || error, error.stack || error);
    console.warn("⚠️ Attempting legacy PlacesService.nearbySearch fallback...");
    
    if (placesService) {
      const placesPromises = [];

      for (const locationType of poiConfig.types) {
        const request = {
          location: coordinates,
          radius: poiConfig.searchRadius,
          type: locationType,
        };

        const placesPromise = new Promise((resolve) => {
          placesService.nearbySearch(request, (results, status) => {
            if (status === "OK" || status === "ZERO_RESULTS") {
              resolve(results || []);
            } else {
              resolve([]);
            }
          });
        });
        placesPromises.push(placesPromise);
      }

      const placesResults = await Promise.all(placesPromises);
      const allPlaces = placesResults.flat();
      
      const uniquePlaces = allPlaces.reduce((acc, place) => {
        if (!acc.some(p => p.place_id === place.place_id)) {
          acc.push(place);
        }
        return acc;
      }, []);

      const mappedLegacy = uniquePlaces.slice(0, poiConfig.density).map(place => {
        const iconName = getPoiIconName(place.types);
        return {
          place_id: place.place_id,
          name: place.name || "",
          geometry: {
            location: place.geometry.location
          },
          icon_background_color: place.icon_background_color || "#4f46e5",
          icon_mask_base_uri: `assets/icons/poi/${iconName}`,
          types: place.types || []
        };
      });

      return mappedLegacy;
    }
    
    return [];
  }
}

/**
 * Converts a location identifier into a Google Maps LatLng object.
 */
export async function getLocation(location, type) {
  await initGoogleMaps();
  
  if (location && typeof location.lat === 'function') {
    return location;
  }
  if (location && typeof location.lat === 'number') {
    return new google.maps.LatLng(location.lat, location.lng);
  }

  let coords = null;
  if (location && typeof location === 'object') {
    if (Array.isArray(location) && location.length >= 2) {
      const lat = parseFloat(location[0]);
      const lng = parseFloat(location[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        coords = new google.maps.LatLng(lat, lng);
      }
    } else {
      const latVal = location.lat;
      const lngVal = location.lng;
      if (latVal !== undefined && lngVal !== undefined) {
        const lat = typeof latVal === 'function' ? latVal() : parseFloat(latVal);
        const lng = typeof lngVal === 'function' ? lngVal() : parseFloat(lngVal);
        if (!isNaN(lat) && !isNaN(lng)) {
          coords = new google.maps.LatLng(lat, lng);
        }
      }
    }
  } else if (typeof location === 'string') {
    const parts = location.split(',');
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        coords = new google.maps.LatLng(lat, lng);
      }
    }
  }

  if (!coords) {
    try {
      coords = new google.maps.LatLng(location);
    } catch (e) {
      coords = null;
    }
  }

  if (coords && !isNaN(coords.lat()) && !isNaN(coords.lng())) {
    return coords;
  }

  if (type === "placeId") {
    return await fetchCoordsByPlaceId(location);
  } else if (type === "placeName") {
    return await fetchCoordsByPlaceName(location);
  } else {
    throw new Error("Invalid type provided to getLocation.");
  }
}

async function fetchCoordsByPlaceId(placeId) {
  try {
    const { Place } = await google.maps.importLibrary("places");
    const place = new Place({ id: placeId });
    await place.fetchFields({ fields: ["location"] });
    return place.location;
  } catch (error) {
    console.error("❌ Google Places (new) API: fetchCoordsByPlaceId failed. Error details:", error.message || error, error.stack || error);
    console.warn("⚠️ Attempting legacy PlacesService.getDetails coordinates fallback...");
    if (placesService) {
      return new Promise((resolve, reject) => {
        placesService.getDetails({ placeId, fields: ["geometry"] }, (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK) {
            resolve(place.geometry.location);
          } else {
            const err = new Error("Failed legacy coordinates fetch by ID: " + status);
            console.error("❌ Legacy fallback failed:", err);
            reject(err);
          }
        });
      });
    }
    throw error;
  }
}

async function fetchCoordsByPlaceName(placeName) {
  try {
    const { Place } = await google.maps.importLibrary("places");
    const request = {
      textQuery: placeName,
      fields: ["location"]
    };
    const { places } = await Place.searchByText(request);
    if (places && places.length > 0) {
      return places[0].location;
    }
    throw new Error("No places returned for query: " + placeName);
  } catch (error) {
    console.error("❌ Google Places (new) API: fetchCoordsByPlaceName failed. Error details:", error.message || error, error.stack || error);
    console.warn("⚠️ Attempting legacy PlacesService.findPlaceFromQuery coordinates fallback...");
    if (placesService) {
      return new Promise((resolve, reject) => {
        placesService.findPlaceFromQuery({ query: placeName, fields: ["geometry"] }, (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            resolve(results[0].geometry.location);
          } else {
            const err = new Error("Failed legacy coordinates fetch by query: " + status);
            console.error("❌ Legacy fallback failed:", err);
            reject(err);
          }
        });
      });
    }
    throw error;
  }
}

/**
 * Initializes Google Places Autocomplete on a given text input.
 */
export async function initAutocomplete(inputElement, onPlaceSelectedCallback) {
  if (!inputElement) return;
  await initGoogleMaps();

  try {
    const { Autocomplete, Place } = await google.maps.importLibrary("places");

    // Add a text-search Enter-key listener
    inputElement.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const query = inputElement.value.trim();
        if (!query) return;

        try {
          const request = {
            textQuery: query,
            fields: ["displayName", "location", "id"]
          };
          const { places } = await Place.searchByText(request);
          if (places && places.length > 0) {
            const firstPlace = places[0];
            const latLng = firstPlace.location;

            const mockPlaceResult = {
              name: firstPlace.displayName || query,
              place_id: firstPlace.id,
              geometry: {
                location: latLng
              }
            };

            onPlaceSelectedCallback(mockPlaceResult);
          }
        } catch (err) {
          console.error("❌ Google Places (new) API: searchByText in autocomplete failed. Error details:", err.message || err, err.stack || err);
          console.warn("⚠️ Attempting legacy PlacesService.findPlaceFromQuery fallback...");
          if (placesService) {
            placesService.findPlaceFromQuery({ query, fields: ["geometry", "name", "place_id"] }, (results, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                const firstResult = results[0];
                onPlaceSelectedCallback(firstResult);
              } else {
                console.error("❌ Legacy search fallback failed inside autocomplete:", status);
              }
            });
          } else {
            console.error("❌ Legacy search fallback skipped (placesService uninitialized):", err);
          }
        }
      }
    });

    try {
      const autocomplete = new Autocomplete(inputElement, {
        fields: ["geometry", "name", "formatted_address"]
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place.geometry && place.geometry.location) {
          onPlaceSelectedCallback(place);
        }
      });
      console.log("✅ Google Places Autocomplete successfully bound.");
    } catch (legacyErr) {
      console.warn("⚠️ Legacy Autocomplete skipped. Enter key triggers Google Places (new) API search. Details:", legacyErr.message || legacyErr);
    }

  } catch (error) {
    console.error(`Error initializing Places Autocomplete: ${error}`);
  }
}

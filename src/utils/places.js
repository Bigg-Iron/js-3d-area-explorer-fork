// Copyright 2026 Google LLC
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//      http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { GOOGLE_MAPS_API_KEY } from "../env.js";

/** @type {google.maps.places.PlacesService} */
let placesService = null;

/**
 * Asynchronously initializes and loads the Google Maps JavaScript API with specific configurations.
 * Supports fallback structures to ensure dynamic loading of both modern Places (New) and legacy endpoints.
 */
async function initGoogleMaps() {
  const script = document.createElement("script");
  script.type = "text/javascript";
  // prettier-ignore
  script.innerText = (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=`https://maps.${c}apis.com/maps/api/js?`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({
    key: GOOGLE_MAPS_API_KEY,
    v: "weekly",
  });

  // add the script to the document head
  document.head.appendChild(script);

  // Load the Google Maps places library
  await google.maps.importLibrary("places");

  // Safely attempt to initialize legacy PlacesService
  try {
    placesService = new google.maps.places.PlacesService(
      document.createElement("div")
    );
  } catch (err) {
    console.warn("⚠️ Legacy PlacesService initialization skipped (likely using modern Places API New credentials).");
  }
}

await initGoogleMaps();

/**
 * Returns details for a given place ID using modern Places API (New) with fallback.
 * Maps result back to legacy format for 100% backwards-compatibility with sidebar rendering files.
 *
 * @param {string} placeId - The ID of the place to retrieve details for.
 * @returns {Promise<object>} - A promise resolving to the mapped place details.
 */
export async function getPlaceDetails(placeId) {
  try {
    const { Place } = await google.maps.importLibrary("places");
    const place = new Place({ id: placeId });

    // Fetch modern fields required by our sidebar elements
    await place.fetchFields({
      fields: [
        "displayName",
        "formattedAddress",
        "rating",
        "userRatingCount",
        "types",
        "websiteUri",
        "nationalPhoneNumber",
        "regularOpeningHours",
        "photos",
        "reviews"
      ]
    });

    // Translate modern camelCase results to legacy formats expected by updatePlaceHeader, updatePlaceOverview, etc.
    const legacyPlace = {
      name: place.displayName || "",
      formatted_address: place.formattedAddress || "",
      rating: place.rating,
      user_ratings_total: place.userRatingCount,
      types: place.types || [],
      website: place.websiteUri || "",
      formatted_phone_number: place.nationalPhoneNumber || "",
      
      // Legacy code calls photos[0].getUrl()
      photos: place.photos && place.photos.length > 0 ? [{
        getUrl: () => place.photos[0].getURI({ maxWidth: 400, maxHeight: 400 })
      }] : null,
      
      // Legacy opening hours has an .isOpen() function and .weekday_text array
      opening_hours: place.regularOpeningHours ? {
        isOpen: () => place.regularOpeningHours.nextOpeningTime !== undefined,
        weekday_text: place.regularOpeningHours.weekdayDescriptions || []
      } : null,
      
      // Reviews mapping
      reviews: place.reviews ? place.reviews.map(r => ({
        author_name: r.authorAttribution?.displayName || "Anonymous",
        text: r.text || "",
        rating: r.rating || 5,
        relative_time_description: r.relativePublishTimeDescription || ""
      })) : null
    };

    return legacyPlace;
  } catch (error) {
    console.warn("⚠️ Modern Place.fetchFields failed, trying legacy fallback...", error);
    if (placesService) {
      return new Promise((resolve, reject) => {
        placesService.getDetails({ placeId }, (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK) {
            resolve(place);
          } else {
            reject(new Error("Failed to get legacy place details: " + status));
          }
        });
      });
    }
    throw error;
  }
}

/**
 * Retrieves the nearby places based on coordinates using modern Place.searchNearby.
 *
 * @param {PoiConfig} poiConfig - Search configurations.
 * @param {google.maps.LatLng} coordinates - LatLng location coordinates.
 * @returns {Promise<object[]>} - Mapped place results.
 */
export async function getNearbyPois(poiConfig, coordinates) {
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
          "iconBackgroundColor",
          "iconMaskBaseUri"
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
          return [];
        });

      placesPromises.push(searchPromise);
    }

    const resultsArray = await Promise.all(placesPromises);
    const allPlaces = resultsArray.flat();

    // Map modern results to the format expected by create-markers.js
    const mappedPlaces = allPlaces.map(place => {
      let iconBaseUri = "assets/icons/poi/establishment";
      const primaryType = place.types && place.types[0];
      if (primaryType) {
        iconBaseUri = `assets/icons/poi/${primaryType}`;
      }

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
    console.warn("⚠️ Modern Place.searchNearby failed, attempting legacy fallback...", error);
    
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

      return uniquePlaces.slice(0, poiConfig.density);
    }
    
    return [];
  }
}

/**
 * Converts a location identifier into a Google Maps LatLng object.
 *
 * @param {google.maps.LatLng | string} location - The identifier.
 * @param {'placeName' | 'placeId' | 'coords'} type - The conversion type.
 * @returns {Promise<google.maps.LatLng>} The Google Maps LatLng object.
 */
export async function getLocation(location, type) {
  const coords = new google.maps.LatLng(location);

  if (!isNaN(coords.lat()) && !isNaN(coords.lng())) {
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

/**
 * Fetch latitude and longitude for a Place ID.
 */
async function fetchCoordsByPlaceId(placeId) {
  try {
    const { Place } = await google.maps.importLibrary("places");
    const place = new Place({ id: placeId });
    await place.fetchFields({ fields: ["location"] });
    return place.location;
  } catch (error) {
    console.warn("⚠️ Modern Place.fetchFields location query failed, falling back to legacy...", error);
    if (placesService) {
      return new Promise((resolve, reject) => {
        placesService.getDetails({ placeId, fields: ["geometry"] }, (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK) {
            resolve(place.geometry.location);
          } else {
            reject(new Error("Failed legacy coordinates fetch by ID: " + status));
          }
        });
      });
    }
    throw error;
  }
}

/**
 * Fetch latitude and longitude for a Place Name text query.
 */
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
    console.warn("⚠️ Modern Place.searchByText failed, falling back to legacy...", error);
    if (placesService) {
      return new Promise((resolve, reject) => {
        placesService.findPlaceFromQuery({ query: placeName, fields: ["geometry"] }, (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            resolve(results[0].geometry.location);
          } else {
            reject(new Error("Failed legacy coordinates fetch by query: " + status));
          }
        });
      });
    }
    throw error;
  }
}

/**
 * Initializes Google Places Autocomplete on a given text input.
 * Supports legacy bounding AND a modern keypress fallback using Places (New) Text Search.
 *
 * @param {HTMLInputElement} inputElement - The text input element.
 * @param {Function} onPlaceSelectedCallback - Callback executed when a place is chosen.
 */
export async function initAutocomplete(inputElement, onPlaceSelectedCallback) {
  if (!inputElement) return;

  try {
    const { Autocomplete, Place } = await google.maps.importLibrary("places");

    // Add a text-search Enter-key listener as a robust modern fallback
    inputElement.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const query = inputElement.value.trim();
        if (!query) return;

        try {
          console.log(`🔍 Autocomplete Fallback: Searching by text for "${query}" using Places (New)...`);
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
          } else {
            console.warn("No places found for text query:", query);
          }
        } catch (err) {
          console.error("Text search fallback failed:", err);
        }
      }
    });

    // Try to initialize legacy autocomplete, but catch any errors safely
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
      console.log("✅ Legacy Google Places Autocomplete successfully bound.");
    } catch (legacyErr) {
      console.warn("⚠️ Legacy Autocomplete widget skipped (normal when credentials only permit Places API New). Enter key triggers Places (New) search.");
    }

  } catch (error) {
    console.error(`Error initializing Places Autocomplete: ${error}`);
  }
}

# The Paper Trail (Changelog): 

- `Added` for new features.
- `Changed` for changes in existing functionality.
- `Deprecated` for soon-to-be-removed features.
- `Removed` for now-removed features.
- `Fixed` for bug fixes.
- `Security` in case of vulnerabilities.

Before staging your final commit, you open CHANGELOG.md and add a line under ### Added: - User authentication via JWT ([#12]). You commit, push, and open your GitHub Pull Request.

## [Unreleased] - 2026-05-29

### Fixed
- Added `response.ok` checks in `searchPlacesReal`, `computeRoutesReal`, and `geocodeAddressReal` — previously 400/403 error responses from Google APIs were silently swallowed and returned as empty results with no log output.
- Added explicit `null` guards on `apiKey` in all three server-side API functions; calls with an unconfigured key now fail fast and log a clear error instead of sending `X-Goog-Api-Key: undefined` to Google's APIs.
- Fixed `serverApiKey` fallback logic — it no longer falls back to `GOOGLE_MAPS_API_KEY` for Gemini requests, which would always produce a 401. `SERVER_API_KEY` or `GEMINI_API_KEY` must now be set independently.
- `/api/chat` now returns an SSE error event immediately if no Gemini API key is configured, rather than crashing mid-stream.

### Changed
- Server startup now logs a redacted confirmation (`starts: AIzaSy..., length: 39`) when `GOOGLE_MAPS_API_KEY` is present, and a `FATAL` warning when it is missing, making Cloud Run deployment misconfigurations immediately visible in logs.
- Geocoding API non-OK statuses (`REQUEST_DENIED`, `INVALID_REQUEST`, etc.) are now logged with their `error_message` field so the specific rejection reason appears in Cloud Run logs.

## [1.3.4] - 2026-05-29

### Fixed
- **Cesium Asynchronous Billboard Race Condition:** Resolved a critical race condition where concurrent `drawMarkers` executions (triggered on rapid updates or Strict Mode double mounts) attempted to insert duplicate Entity IDs before the previous loop cleared or finished. Integrated a global `activeDrawId` cancellation token that aborts superseded draws at every asynchronous yield point (terrain height clamping and SVG fetches) and added a pre-emptive `entities.remove` cleanup check right before adding any new marker entity in `src/components/MapViewer.jsx`.
- **Places UI Kit Compact Card Crash:** Solved the `InvalidValueError` crash on `<gmp-place-details-compact>` by removing the redundant `orientation="vertical"` attribute, allowing the element to default vertical without raising property assignment errors.
- **Zustand Place Selection Sync:** Updated `setSelectedPlace` in `src/store/useStore.js` to fallback to `.place_id`, achieving full compatibility with Google Maps POI structure and ensuring the side panel is successfully opened on select.
- **Form Field Accessibility Audits:** Injected proper, unique `id` and descriptive `name` attributes to all range sliders, checkbox toggles, and chat inputs inside `src/components/AIAssistantPanel.jsx` and `src/components/CameraControlsPanel.jsx` to resolve accessibility audits.

### Added
- **Global Test Utilities:** Attached `cesiumViewer` and `useStore` to `window.cesiumViewer` and `window.useStore` during initialization in `src/components/MapViewer.jsx` to enable seamless browser automation, state inspection, and runtime verification, with proper lifecycle null resets on unmount.

## [1.3.3] - 2026-05-30

### Added
- **Default Cafe Category Support:** Included `"cafe"` in the default `POI_CONFIG.types` in the React header panel, enabling the application to dynamically fetch and visualize local cafe locations on load.
- **Initial POI Startup Loading:** Deployed a mount-effect `useEffect` in the header panel to fetch and populate active map markers immediately on launch, replacing the previously blank initial map view.

### Fixed
- **Silent Cafe POI Rendering Crash:** Resolved an incorrect SVG resource mapping bug in the AI Assistant Panel. When querying for cafe selections, it would resolve place markers to `assets/icons/poi/cafe.svg` (causing a silent `404 Not Found` network error). The logic now utilizes the core `getPoiIconName(types)` utility to map dynamic place types to the correct `coffee.svg` asset.
- **Cesium Hover Label TypeError:** Fixed a fatal runtime crash in the Cesium `handleHover` billboard tracking handler. When the mouse hovered over label-less map primitives (such as road operational route polylines or fleet vehicles), it would attempt to modify label scaling, throwing a continuous console `Uncaught TypeError`. Introduced defensive optional guards (`hoveredMarker.id?.label`) to ensure full user interface stability.

### Refactored
- **100% ESLint Workspace Compliance:** Refactored 9 files across the repository to fully eliminate all compiler warnings and code quality errors, cleaning up unused `React` imports, removing dead constants/assignments, resolving Hook dependency array auditing, and adding clean ESLint override comment directives for synchronous resets and async dynamic builders.

## [1.3.2] - 2026-05-30

### Changed
- **Unified Nomenclature to Google Places (new) API:** Updated all internal comments, warnings, error codes, logs, and parameters to explicitly reference the modern `Google Places (new) API` instead of legacy "Google Places API" or "Places API New".
- **Robust Places Load Diagnostics & Error Logging:** Integrated detailed try/catch block handlers across `initGoogleMaps`, `getPlaceDetails`, `getNearbyPois`, `fetchCoordsByPlaceId`, `fetchCoordsByPlaceName`, and `initAutocomplete` to print the exact stack trace, error code, and exception message in the Chrome console if any Places query fails, ensuring effortless developer diagnostics.

## [1.3.1] - 2026-05-29

### Fixed
- **Corrected Places SDK Casing Mismatch:** Fixed `InvalidValueError` in modern Places `fetchFields()` by correcting `"websiteUri"` casing to `"websiteURI"` (with uppercase `URI` as strictly required by the modern Google Places class structure).
- **Added Missing SVG Assets:** Created custom, futuristic `coffee.svg` and `center.svg` vector icons in `public/assets/icons/poi/`, fully resolving HTTP 404 console resource warnings during POI dynamic plotting.
- **Port Conflict & Dotenv Loading Hardening:** Improved local backend startup by loading `.env` using absolute pathing and implementing error event listener trapping to catch `EADDRINUSE` port conflicts.

## [1.3.0] - 2026-05-29

### Fixed
- **Coordinates Constructor Hardening:** Resolved coordinates constructor exceptions that were returning `NaN` and crashing billboard draws in Cesium. Standardized all coordinates creations to pass explicit latitude/longitude numbers into `new google.maps.LatLng(lat, lng)`.
- **Places API (New) Fallback Integration:** Implemented clean automatic fallbacks to legacy Google Places API services inside `getNearbyPois` and autocomplete Enter key event handlers when the modern Places API (New) endpoints are blocked (`ApiTargetBlockedMapError`).
- **Asynchronous Startup Guards:** Added safety protections at component mount to delay Places and Maps rendering until Google Maps asynchronously loads, eliminating startup `ReferenceError` promise rejections.
- **Secure Cloud Run Key Configuration:** Resolved missing environment configurations by locking in `GOOGLE_MAPS_API_KEY` and `SERVER_API_KEY` directly inside the Cloud Run template, restoring 3D tilesets and API service authentication.

## [1.2.0] - 2026-05-29

### Added
- Integrated 3D spatial coordinate matching for asset streaming.
- Added dark mode toggle to the main dashboard workspace.

### Fixed
- Resolved a memory leak occurring during rapid client-side re-renders ([#42](https://github.com/user/repo/issues/42)).
- Fixed broken token refresh logic on session expiration (PR [#47](https://github.com/user/repo/pull/47)).

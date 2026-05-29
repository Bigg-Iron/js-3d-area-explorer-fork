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

## 0.1.0

# Example of the format to be used --

## [1.2.0] - 2026-05-29

### Added
- Integrated 3D spatial coordinate matching for asset streaming.
- Added dark mode toggle to the main dashboard workspace.

### Fixed
- Resolved a memory leak occurring during rapid client-side re-renders ([#42](https://github.com/user/repo/issues/42)).
- Fixed broken token refresh logic on session expiration (PR [#47](https://github.com/user/repo/pull/47)).

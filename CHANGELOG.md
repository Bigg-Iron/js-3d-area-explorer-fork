# The Paper Trail (Changelog): 

- `Added` for new features.
- `Changed` for changes in existing functionality.
- `Deprecated` for soon-to-be-removed features.
- `Removed` for now-removed features.
- `Fixed` for bug fixes.
- `Security` in case of vulnerabilities.

Before staging your final commit, you open CHANGELOG.md and add a line under ### Added: - User authentication via JWT ([#12]). You commit, push, and open your GitHub Pull Request.

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

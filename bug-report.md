# Bug Report & Resolutions

## Open Issues
- [ ] BigQuery error on startup:
  ```javascript
  deck-layers.js:220 Error clamping BigQuery columns to heights: JS {name: 'RuntimeError', message: 'An entity with id bq-column-us6000t04s already exists in this collection.', stack: 'Error\n    at new JS (https://ajax.googleapis.com/a…0.us-central1.run.app/utils/deck-layers.js:151:25'}
  (anonymous) @ deck-layers.js:220
  ```
- [ ] Search autocomplete populates but doesn't execute query.
- [ ] USGS earthquake data limited in scope (only see one earthquake) and not clickable
- [ ] UI/UX AI assistant chat window can become hidden under top menu bar.
- [ ] Street view hidden.

## Resolved Issues
- `[x]` **Bug 1: Fleet Engine overlay moves with camera, should be clamped to the ground and grounded with real road data**
  * **Status:** RESOLVED
  * **Cause:** The simulated fleet routes were generated as a fixed, relative grid shifted linearly from the NYC coordinates. When plotted in other cities, they cut straight through buildings and water at sea level. Because they did not sit flat on the streets of the 3D tiles, orbiting or moving the camera created a parallax slipping effect (appearing to float/slide relative to the camera viewpoint).
  * **Fix:** 
    1. Decoupled the relative linear shift and integrated the live browser **Google Maps Directions Service** inside `fleet-simulator.js`.
    2. When the operational center coordinates change, the simulator dynamically requests three real, snapping driving paths around the city center.
    3. Added a callback parameter that automatically redraws the static routes and snaps the dynamic vehicles to the actual local street segments and grade once resolved.
    4. Confirmed that snapping to the street layout eliminates the parallax floating effect, grounding vehicles on real-world road networks perfectly.


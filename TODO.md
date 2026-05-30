<!-- Inside your new branch, you open TODO.md. You break down Issue #12 into 5 granular micro-tasks (e.g., - [ ] hash password, - [ ] set up JWT cookie, - [ ] test edge cases). You check them off as you code. -->
- [] Issue #1: Google Places API is deprecated. Need to migrate and modify all references to the Google Places API to the Google Places API (New): See:
 https://developers.google.com/maps/documentation/places/web-service/op-overview


<!-- The Cleanup:Step 3.Once the code works and your local TODO.md is clear, you delete those temporary scratchpad lines so the file stays clean for the next branch, or leave only permanent project-level reminders. -->

## Active Feature: Optimize BigQuery for Geospatial 
- [ ] Create Tailwind theme config for dark variant
- [ ] Build Context provider to persist user theme choice in LocalStorage
- [ ] Design the UI toggle switch component for the Navbar
- [ ] Fix contrast bugs on the metrics dashboard charts

## Active Feature: Integrate OpenSky --> FleetEngine
 - [ ] Look into OpenSky API 
 - [ ] Research intoFleetEngine
 - [ ] 

## Active Feature: StreetView 
 - [ ]
 - [ ]

## Active Feature: Oriient Indoor Mapping
 - [ ]
 - [ ]  

## Active Feature: Rendering Performance Optimizations 
 - [ ] Introduce quadtree or similar spatial partitioning to limit the number of Deck.gl layers and objects processed during each render cycle.
 - [ ] Explore WebGL-specific optimizations, such as using instancing for Deck.gl layers or custom layer implementations that bypass some of the standard overhead when dealing with large datasets.
 - [ ] Implement object pooling and reuse for the dynamic entities (planes, vessels) to reduce memory allocation and garbage collection pressure.
 - [ ] Refactor the data pipeline to use more efficient data structures (e.g., typed arrays, spatial indexing) for the large-scale geospatial data.
 - [ ] Add "LOD" (Level of Detail) rendering, where the complexity of the 3D models and data representation adapts to the current zoom level or camera distance to maintain frame rates.
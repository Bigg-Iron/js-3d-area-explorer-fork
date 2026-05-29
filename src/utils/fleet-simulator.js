// Copyright 2026 Google LLC
// Fleet Engine Simulator for Real-time Vehicle Tracking

const CHELSEA_ROUTES = {
  truck_01: [
    { lat: 40.7420, lng: -74.0060 },
    { lat: 40.7445, lng: -74.0060 },
    { lat: 40.7445, lng: -74.0020 },
    { lat: 40.7420, lng: -74.0020 },
    { lat: 40.7420, lng: -74.0060 }
  ],
  van_02: [
    { lat: 40.7400, lng: -74.0080 },
    { lat: 40.7400, lng: -74.0040 },
    { lat: 40.7460, lng: -74.0040 },
    { lat: 40.7460, lng: -74.0080 },
    { lat: 40.7400, lng: -74.0080 }
  ],
  cargo_03: [
    { lat: 40.7450, lng: -74.0090 },
    { lat: 40.7410, lng: -74.0090 },
    { lat: 40.7410, lng: -74.0070 },
    { lat: 40.7450, lng: -74.0070 },
    { lat: 40.7450, lng: -74.0090 }
  ]
};

class FleetSimulator {
  setCenter(newCenter, onRoutesUpdated) {
    // 1. Immediate local fallback translation (linear offsets)
    const oldCenter = { lat: 40.74244, lng: -74.006144 };
    const deltaLat = newCenter.lat - oldCenter.lat;
    const deltaLng = newCenter.lng - oldCenter.lng;

    this.vehicles[0].route = CHELSEA_ROUTES.truck_01.map(p => ({
      lat: p.lat + deltaLat,
      lng: p.lng + deltaLng
    }));
    this.vehicles[1].route = CHELSEA_ROUTES.van_02.map(p => ({
      lat: p.lat + deltaLat,
      lng: p.lng + deltaLng
    }));
    this.vehicles[2].route = CHELSEA_ROUTES.cargo_03.map(p => ({
      lat: p.lat + deltaLat,
      lng: p.lng + deltaLng
    }));

    this.vehicles.forEach(vehicle => {
      vehicle.position = { ...vehicle.route[0] };
      vehicle.currentIndex = 0;
      vehicle.progress = 0;
    });

    // 2. Asynchronous Directions Service lookup to snap to actual local streets
    try {
      if (typeof google !== "undefined" && google.maps && google.maps.DirectionsService) {
        const directionsService = new google.maps.DirectionsService();
        
        // Form three distinct routes in the searched city centered around new center coords
        const tasks = [
          {
            origin: new google.maps.LatLng(newCenter.lat - 0.003, newCenter.lng - 0.003),
            destination: new google.maps.LatLng(newCenter.lat + 0.003, newCenter.lng + 0.003)
          },
          {
            origin: new google.maps.LatLng(newCenter.lat + 0.003, newCenter.lng - 0.002),
            destination: new google.maps.LatLng(newCenter.lat - 0.002, newCenter.lng + 0.003)
          },
          {
            origin: new google.maps.LatLng(newCenter.lat - 0.002, newCenter.lng + 0.003),
            destination: new google.maps.LatLng(newCenter.lat + 0.003, newCenter.lng - 0.002)
          }
        ];

        let completedQueries = 0;
        tasks.forEach((task, index) => {
          directionsService.route({
            origin: task.origin,
            destination: task.destination,
            travelMode: google.maps.TravelMode.DRIVING
          }, (result, status) => {
            completedQueries++;
            if (status === google.maps.DirectionsStatus.OK && result.routes && result.routes.length > 0) {
              const path = result.routes[0].overview_path;
              if (path && path.length > 0) {
                const realRoute = path.map(latLng => ({
                  lat: latLng.lat(),
                  lng: latLng.lng()
                }));
                // Update vehicle with the real road-snapped coordinates
                this.vehicles[index].route = realRoute;
                this.vehicles[index].position = { ...realRoute[0] };
                this.vehicles[index].currentIndex = 0;
                this.vehicles[index].progress = 0;
              }
            } else {
              console.warn(`⚠️ Snapping vehicle_${index} to roads failed: status ${status}`);
            }

            // Once all routes finish, trigger the callback to redraw polylines on map
            if (completedQueries === tasks.length && typeof onRoutesUpdated === "function") {
              onRoutesUpdated();
            }
          });
        });
      }
    } catch (err) {
      console.warn("⚠️ Google Maps Directions Service is not initialized for Fleet Engine snapping:", err);
    }
  }

  constructor() {
    this.vehicles = [
      {
        id: "truck-01",
        driver: "Marcus Vance",
        route: CHELSEA_ROUTES.truck_01,
        currentIndex: 0,
        position: { ...CHELSEA_ROUTES.truck_01[0] },
        speed: 0.05, // Speed factor
        status: "EN_ROUTE",
        eta: 8, // Minutes
        task: "Delivering Organic Produce to Chelsea Market",
        fuel: 82, // %
        type: "Heavy Cargo"
      },
      {
        id: "van-02",
        driver: "Sophia Chen",
        route: CHELSEA_ROUTES.van_02,
        currentIndex: 0,
        position: { ...CHELSEA_ROUTES.van_02[0] },
        speed: 0.07,
        status: "EN_ROUTE",
        eta: 4,
        task: "Last-Mile Delivery to Google NYC Office",
        fuel: 95,
        type: "Electric Van"
      },
      {
        id: "cargo-03",
        driver: "David Miller",
        route: CHELSEA_ROUTES.cargo_03,
        currentIndex: 0,
        position: { ...CHELSEA_ROUTES.cargo_03[0] },
        speed: 0.04,
        status: "DELAYED",
        eta: 14,
        task: "Logistics Transfer from Pier 57 Hub",
        fuel: 48,
        type: "Flatbed Truck"
      }
    ];
  }

  // Interpolate between two coordinates
  lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
  }

  // Update vehicle position along its route
  update(deltaTime) {
    this.vehicles.forEach(vehicle => {
      if (vehicle.status === "DELAYED" && Math.random() < 0.01) {
        // Occasionally solve delays
        vehicle.status = "EN_ROUTE";
      }

      const route = vehicle.route;
      const targetIndex = (vehicle.currentIndex + 1) % route.length;
      const start = route[vehicle.currentIndex];
      const end = route[targetIndex];

      // Calculate new position
      if (!vehicle.progress) vehicle.progress = 0;
      vehicle.progress += vehicle.speed * deltaTime;

      if (vehicle.progress >= 1) {
        vehicle.progress = 0;
        vehicle.currentIndex = targetIndex;
        vehicle.position = { ...end };
        // Randomize ETA slightly
        vehicle.eta = Math.max(1, vehicle.eta - 1);
        if (vehicle.eta === 1 && Math.random() < 0.3) {
          vehicle.eta = 10; // New cycle
        }
      } else {
        vehicle.position.lat = this.lerp(start.lat, end.lat, vehicle.progress);
        vehicle.position.lng = this.lerp(start.lng, end.lng, vehicle.progress);
      }
      
      // Update fuel consumption
      if (Math.random() < 0.05) {
        vehicle.fuel = Math.max(5, vehicle.fuel - 1);
      }
    });
  }

  getVehicles() {
    return this.vehicles.map(v => ({
      id: v.id,
      driver: v.driver,
      position: { lat: v.position.lat, lng: v.position.lng },
      status: v.status,
      eta: v.eta,
      task: v.task,
      fuel: v.fuel,
      type: v.type,
      route: v.route
    }));
  }
}

export const fleetSimulator = new FleetSimulator();

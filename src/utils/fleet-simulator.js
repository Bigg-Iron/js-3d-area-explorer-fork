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

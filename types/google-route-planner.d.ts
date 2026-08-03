export interface SanpoRoutePlace {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface SanpoRouteLeg {
  distanceMeters: number;
  durationSeconds: number;
  start: { latitude: number; longitude: number } | null;
  end: { latitude: number; longitude: number } | null;
  fromName: string;
  toName: string;
}

export interface SanpoRouteCandidate {
  id: string;
  label: string;
  distanceMeters: number;
  durationSeconds: number;
  legs: SanpoRouteLeg[];
  viewport: { north: number; south: number; east: number; west: number } | null;
  polyline: string;
  hasTolls: boolean;
  hasHighways: boolean;
  tollPrice: string;
  mainRoads: string[];
}

export interface SanpoRoutePlannerState {
  origin: SanpoRoutePlace | null;
  waypoints: SanpoRoutePlace[];
  destination: SanpoRoutePlace | null;
  routes: SanpoRouteCandidate[];
  selectedRouteIndex: number;
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
  targetCarId: string;
  targetCarName: string;
  returnTo: '' | 'carSettlement';
  roundTrip: boolean;
  calculatedAt: number;
}

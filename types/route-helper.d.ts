interface SanpoRoutePlace {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}
interface SanpoRouteLeg {
  index: number;
  distanceMeters: number;
  durationSeconds: number;
  startName: string;
  endName: string;
}
interface SanpoTollPrice { currencyCode?: string; units?: number; nanos?: number; }
interface SanpoRouteViewport { south: number; west: number; north: number; east: number; }
interface SanpoStoredRoute {
  id: string;
  label: string;
  description: string;
  distanceMeters: number;
  durationSeconds: number;
  legs: SanpoRouteLeg[];
  viewport: SanpoRouteViewport | null;
  polyline: string;
  hasTolls: boolean;
  hasHighways: boolean;
  restrictionsPartiallyIgnored: boolean;
  highwayDetection: string;
  tollPrice: SanpoTollPrice | null | object;
  mainRoads: string[];
  sourceKind: string;
  isDefault: boolean;
  isRecommended: boolean;
  routeLabels: string[];
  warnings: string[];
}
interface SanpoRoutePlannerState {
  origin: SanpoRoutePlace | null;
  waypoints: SanpoRoutePlace[];
  destination: SanpoRoutePlace | null;
  routes: SanpoStoredRoute[];
  selectedRouteIndex: number;
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
  targetCarId: string;
  returnTo: 'carSettlement' | 'settlementSummary';
  roundTrip: boolean;
  calculatedAt: number;
}

interface SanpoGoogleMapsConfig { apiKey: string; language: string; region: string; version: string; }
interface Window {
  SANPO_GOOGLE_MAPS_CONFIG?: SanpoGoogleMapsConfig;
  __SANPO_GOOGLE_MAPS_TEST_LIBRARIES__?: Record<string, any>;
  loadSanpoGoogleMapsLibraries(): Promise<Record<string, any>>;
  computeSanpoRoutes(state: SanpoRoutePlannerState): Promise<{routes: SanpoStoredRoute[]; libraries: Record<string, any>; hasWaypoints: boolean}>;
  openRouteDistanceHelper(context?: {targetCarId?: string; returnTo?: 'carSettlement'}): Promise<void>;
  getActiveSettlementCarEditName(): string;
}

declare function ensureSettlementState(): any;
declare function save(): void;
declare function saveLocalDraftOnly(): void;
declare function getRoutePlannerState(): SanpoRoutePlannerState;
declare function setRoutePlannerState(state: SanpoRoutePlannerState, options?: Record<string, any>): SanpoRoutePlannerState;
declare function normalizeRoutePlace(value: unknown): SanpoRoutePlace | null;
declare function computeSanpoRoutes(state: SanpoRoutePlannerState): Promise<any>;
declare function renderRouteMap(routes: any[], state: SanpoRoutePlannerState, index: number, onSelect?: Function, libraries?: any): Promise<void>;
declare function selectRouteOnMap(index: number, route: any): void;
declare function loadSanpoGoogleMapsLibraries(): Promise<any>;
declare function ensureRouteMap(libraries?: any): Promise<any>;
declare function saveSettlementCarEditDraft(): void;
declare function normalizeCarSettlementState(value: any): any;
declare function renderSettlementView(options?: any): void;
declare function openSettlementCarEditor(name: string): void;
declare function getActiveSettlementCarEditName(): string;
declare var modals: Record<string, any>;
declare var Sortable: any;

interface Window {
  google?: any;
  SanpoApp?: any;
  SanpoCarbon?: any;
  escapeHtml?: Function;
  showStatus?: Function;
}
interface Element {
  checked?: boolean;
  disabled?: boolean;
  open?: boolean;
  selected?: boolean;
  kind?: string;
  status?: string;
  value?: any;
}
interface HTMLElement {
  checked?: boolean;
  disabled?: boolean;
  open?: boolean;
  selected?: boolean;
  kind?: string;
  status?: string;
  value?: any;
}

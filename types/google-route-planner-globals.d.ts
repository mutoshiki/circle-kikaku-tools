declare var activeCarPlanId: string;
declare var roomId: string;
declare var activeSettlementCarEditName: string;
declare var modals: Record<string, { show(): void; hide(): void } | null>;
declare const Sortable: new (element: Element, options?: Record<string, unknown>) => { destroy(): void };
declare function byId(id: string): any;
declare function ensureSettlementState(): any;
declare function normalizeRoutePlannerState(value?: any): import('./google-route-planner').SanpoRoutePlannerState;
declare function syncSettlementStateFromDOM(): any;
declare function saveLocalDraftOnly(): void;
declare function save(): void;
declare function renderSettlementView(options?: Record<string, unknown>): void;
declare function applyRuntimeAccessibilityFixes(root?: ParentNode): void;
declare function escapeHtml(value: unknown): string;

interface Window {
  SANPO_GOOGLE_MAPS_CONFIG?: Record<string, unknown>;
  SanpoGoogleMaps: any;
  SanpoApp: any;
  google: any;
  getActiveSettlementCarEditName?: () => string;
  openSettlementCarEditor?: (encodedName: string) => void;
  saveSettlementCarEditDraft?: () => void;
  openRouteDistanceHelper?: () => void;
  openRouteDistanceHelperFromShortcut?: () => void;
  addRouteWaypoint?: () => void;
  removeRouteWaypoint?: (id: string) => void;
  selectGoogleRoute?: (index: number) => void;
  applySelectedRouteDistance?: () => void;
  closeRoutePlanner?: () => void;
  refreshGoogleRoutes?: () => Promise<void>;
  [key: string]: any;
}

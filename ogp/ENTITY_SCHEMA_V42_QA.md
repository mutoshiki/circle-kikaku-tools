# Entity Schema v42 QA

## Why this is a root-level change

Schema v4 stored the same people repeatedly in `waiting`, `cars`, and both `carPlans`. Multi-device writes therefore had multiple competing copies of the roster. Schema v5 removes those persisted mirrors.

Canonical Firebase room shape:

- `participants/{participantId}` — one authoritative person record.
- `allocations/car/groups/{groupId}` and `allocations/car/placements/{participantId}`.
- `allocations/team/groups/{groupId}` and `allocations/team/placements/{participantId}`.
- `settlement/carsByParticipantId/{participantId}` and participant-id keyed payment maps.

`waiting`, `cars`, and `carPlans` still exist as in-memory UI projections for compatibility with the existing Carbon UI, but they are generated from the canonical entity tree and are not persisted.

## Migration

A v1-v4 room is converted once when read. Participant ids are stable and deterministic for the migrated roster. The migration writes the v5 canonical roots and deletes the legacy `waiting`, `cars`, `carPlans`, `activeCarPlanId`, and `lastAutoAssignLabel` roots in one Firebase multi-location update.

## Collaborative write policy

Normal saves use Firebase multi-location `update()` with only changed entity paths:

- deleting a person writes `participants/{id}=null` plus that id's placement removals;
- moving another person writes only `allocations/{type}/placements/{otherId}`;
- editing one car's settlement writes only `settlement/carsByParticipantId/{driverId}`;
- rename keeps the participant id, so settlement ownership does not move to a new string key.

This makes a participant deletion structurally authoritative. A stale allocation placement without a matching participant master record is ignored and cannot recreate a card.

## Participant registration

Participant registration now edits the participant master directly. The car-driver list updates the car allocation only. The team allocation references the same participant master, prunes deleted ids, and puts newly added ids into waiting instead of copying person records.

## Shared sheet editor

Shared-screen quick edits are converted back into canonical allocation placements before persistence. The sheet no longer owns a separate persisted `carPlans` snapshot.

## Regression checks

`npm test` passes including `tests/entity-schema-v42-contract.mjs` for:

- v4 -> v5 migration with no persisted roster duplicates;
- participant ids attached to UI projections;
- deletion from the active roster also removes the person from the other allocation;
- participant-id keyed settlement cleanup;
- rename preserving the same settlement entity;
- new participants becoming available in the other allocation;
- concurrent Alice deletion + Bob move preserving both operations;
- Firebase patch containing an explicit participant deletion but no stale Bob write.

All JavaScript files pass `node --check`.

## Rendered-browser limitation

The available Chromium runtime is blocked from navigating to localhost with `ERR_BLOCKED_BY_ADMINISTRATOR`, so full URL-driven browser QA could not be completed in this environment. Existing static/UI contracts and the new entity/concurrency contract pass.

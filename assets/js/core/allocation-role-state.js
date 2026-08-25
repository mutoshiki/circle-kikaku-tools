// Allocation role compatibility layer.
// The canonical schema historically used one structural `driver` placement as each
// group anchor. The UI now treats driver/leader as an independent per-person role.
// Keep the anchor for backward-compatible group identity while persisting the role
// as `placement.driver`. Legacy gender fields are discarded at every state boundary.
(function (global) {
    'use strict';

    if (global.__allocationRoleStateInstalled) return;
    const original = global.SanpoCanonicalState;
    if (!original) return;
    global.__allocationRoleStateInstalled = true;

    const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
    const cloneWithoutGender = value => {
        if (Array.isArray(value)) return value.map(cloneWithoutGender);
        if (!value || typeof value !== 'object') return value;
        const next = {};
        Object.entries(value).forEach(([key, child]) => {
            if (key === 'gender' || key === 'driverGender') return;
            next[key] = cloneWithoutGender(child);
        });
        return next;
    };

    function sanitizeCanonicalRoom(room) {
        if (!room || typeof room !== 'object') return room;
        Object.values(room.participants || {}).forEach(participant => {
            if (participant && typeof participant === 'object') delete participant.gender;
        });
        return room;
    }

    function roleFromPlacement(placement, structuralOwner = false) {
        if (hasOwn(placement, 'driver')) return placement.driver === true;
        // Existing rooms used `kind: driver` as both structure and role. Preserve
        // that visible meaning once, then future captures persist an explicit bool.
        return structuralOwner && placement?.kind === 'driver';
    }

    function annotateRoles(room, domAllocation, type) {
        const allocation = room?.allocations?.[type];
        if (!allocation) return;
        const cars = Array.isArray(domAllocation?.cars) ? domAllocation.cars : [];
        cars.forEach(car => {
            const groupId = String(car?.groupId || '');
            const group = allocation.groups?.[groupId]
                || Object.values(allocation.groups || {}).find(candidate => candidate?.ownerId === car?.participantId);
            const ownerId = String(car?.participantId || group?.ownerId || '');
            const ownerPlacement = allocation.placements?.[ownerId];
            if (ownerPlacement) ownerPlacement.driver = car?.driver !== false;
            (Array.isArray(car?.members) ? car.members : []).forEach(member => {
                const id = String(member?.participantId || member?.id || '');
                if (id && allocation.placements?.[id]) allocation.placements[id].driver = member?.driver === true;
            });
        });
        (Array.isArray(domAllocation?.waiting) ? domAllocation.waiting : []).forEach(member => {
            const id = String(member?.participantId || member?.id || '');
            if (id && allocation.placements?.[id]) allocation.placements[id].driver = false;
        });
    }

    function projectAllocation(room, type) {
        const canonical = sanitizeCanonicalRoom(room || original.get?.());
        const plan = cloneWithoutGender(original.projectAllocation(canonical, type));
        const allocation = canonical?.allocations?.[type] || {};
        (plan.cars || []).forEach(car => {
            const ownerPlacement = allocation.placements?.[car.participantId];
            car.driver = roleFromPlacement(ownerPlacement, true);
            delete car.driverGender;
            (car.members || []).forEach(member => {
                member.driver = roleFromPlacement(allocation.placements?.[member.participantId], false);
                delete member.gender;
            });
        });
        (plan.waiting || []).forEach(member => {
            member.driver = false;
            delete member.gender;
        });
        return plan;
    }

    function captureFromDom(room, domAllocation, type) {
        const cleanDom = cloneWithoutGender(domAllocation || {});
        const result = original.captureFromDom(room, cleanDom, type);
        annotateRoles(room, cleanDom, type);
        sanitizeCanonicalRoom(room);
        return result;
    }

    function setState(raw) {
        const room = original.set(cloneWithoutGender(raw || {}));
        sanitizeCanonicalRoom(room);
        return room;
    }

    function migrateState(raw) {
        const room = original.migrate(cloneWithoutGender(raw || {}));
        sanitizeCanonicalRoom(room);
        return room;
    }

    function createSnapshotFromUi(options = {}) {
        const cleanOptions = { ...options, domAllocation: cloneWithoutGender(options.domAllocation || null) };
        const snapshot = original.createSnapshotFromUi(cleanOptions);
        if (cleanOptions.domAllocation) annotateRoles(original.get?.(), cleanOptions.domAllocation, cleanOptions.activeType === 'team' ? 'team' : 'car');
        sanitizeCanonicalRoom(original.get?.());
        const current = original.get?.();
        if (current && snapshot?.allocations) {
            ['car', 'team'].forEach(type => {
                const currentPlacements = current.allocations?.[type]?.placements || {};
                const snapshotPlacements = snapshot.allocations?.[type]?.placements || {};
                Object.entries(currentPlacements).forEach(([id, placement]) => {
                    if (snapshotPlacements[id] && hasOwn(placement, 'driver')) snapshotPlacements[id].driver = placement.driver === true;
                });
            });
        }
        return cloneWithoutGender(snapshot);
    }

    function projectPlans(room) {
        return [projectAllocation(room, 'car'), projectAllocation(room, 'team')];
    }

    const wrapped = Object.freeze({
        ...original,
        migrate: migrateState,
        get() { return sanitizeCanonicalRoom(original.get?.()); },
        set: setState,
        projectAllocation,
        projectPlans,
        captureFromDom,
        createSnapshotFromUi,
        ensureParticipant(...args) {
            const result = original.ensureParticipant(...args);
            sanitizeCanonicalRoom(original.get?.());
            return result;
        },
        applyProjectedPlan(room, plan, type) {
            const cleanPlan = cloneWithoutGender(plan || {});
            const result = original.applyProjectedPlan(room, cleanPlan, type);
            annotateRoles(room, cleanPlan, type === 'team' ? 'team' : 'car');
            sanitizeCanonicalRoom(room);
            return result;
        }
    });
    global.SanpoCanonicalState = wrapped;

    // DOM projection adapters. Keep legacy function signatures callable while
    // ensuring active snapshots no longer emit gender and do emit per-person role.
    const originalGetMemData = global.getMemData;
    if (typeof originalGetMemData === 'function') {
        global.getMemData = function (element) {
            const record = cloneWithoutGender(originalGetMemData(element) || {});
            record.driver = element?.dataset?.driver === 'true';
            return record;
        };
    }

    const originalGetCurrentAllocationFromDom = global.getCurrentAllocationFromDom;
    if (typeof originalGetCurrentAllocationFromDom === 'function') {
        global.getCurrentAllocationFromDom = function () {
            const projected = cloneWithoutGender(originalGetCurrentAllocationFromDom() || { waiting: [], cars: [] });
            const boxes = Array.from(document.querySelectorAll('#cars-container .car-box'));
            (projected.cars || []).forEach((car, index) => {
                const box = boxes[index];
                const owner = box?.querySelector('.driver-seat');
                car.driver = owner?.dataset?.driver !== 'false';
                const memberCards = Array.from(box?.querySelectorAll('.seat-slot .member-card') || []);
                (car.members || []).forEach((member, memberIndex) => {
                    member.driver = memberCards[memberIndex]?.dataset?.driver === 'true';
                    delete member.gender;
                });
                delete car.driverGender;
            });
            (projected.waiting || []).forEach(member => {
                member.driver = false;
                delete member.gender;
            });
            return projected;
        };
    }

    const originalAddCar = global.addCar;
    if (typeof originalAddCar === 'function') {
        global.addCar = function (...args) {
            const participantId = String(args[7] || '');
            const room = wrapped.get();
            const type = room?.activeAllocationType === 'team' ? 'team' : 'car';
            const placement = room?.allocations?.[type]?.placements?.[participantId];
            args[9] = roleFromPlacement(placement, true);
            return originalAddCar(...args);
        };
    }

    global.SanpoAllocationRoles = Object.freeze({
        isEnabled(participantId, type = wrapped.get()?.activeAllocationType || 'car') {
            const room = wrapped.get();
            const allocation = room?.allocations?.[type];
            const placement = allocation?.placements?.[participantId];
            const structuralOwner = Object.values(allocation?.groups || {}).some(group => group?.ownerId === participantId);
            return roleFromPlacement(placement, structuralOwner);
        },
        sanitizeRoom: sanitizeCanonicalRoom
    });
})(window);

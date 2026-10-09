const sameCatalog = (left = [], right = []) => JSON.stringify(left) === JSON.stringify(right);

function mergeRoutePlaceCatalog(baseCatalog = [], remoteCatalog = [], localCatalog = []) {
  const baseIds = new Set((Array.isArray(baseCatalog) ? baseCatalog : []).map(place => place?.placeId).filter(Boolean));
  const remote = Array.isArray(remoteCatalog) ? remoteCatalog : [];
  const local = Array.isArray(localCatalog) ? localCatalog : [];
  const localAdditions = local.filter(place => place?.placeId && !baseIds.has(place.placeId));
  const remoteAdditions = remote.filter(place => place?.placeId && !baseIds.has(place.placeId));
  const result = [];
  const seen = new Set();
  for (const place of [...localAdditions, ...remoteAdditions, ...local, ...remote]) {
    if (!place?.placeId || seen.has(place.placeId)) continue;
    seen.add(place.placeId);
    result.push(place);
    if (result.length === 48) break;
  }
  return result;
}

export function withRoutePlaceCatalogMerge(sync) {
  const applyVersionedEntityPatch = sync.applyVersionedEntityPatch;
  return Object.freeze({
    ...sync,
    applyVersionedEntityPatch(remoteRaw, baseRaw, localRaw, patch, ...rest) {
      const result = applyVersionedEntityPatch(remoteRaw, baseRaw, localRaw, patch, ...rest);
      const path = 'settlement/routePlaceCatalog';
      if (!Object.hasOwn(patch || {}, path)) return result;
      if (Number(result.resetGeneration || 0) !== Number(baseRaw?.resetGeneration || 0)) return result;

      const baseCatalog = baseRaw?.settlement?.routePlaceCatalog || [];
      const remoteCatalog = remoteRaw?.settlement?.routePlaceCatalog || [];
      const localCatalog = localRaw?.settlement?.routePlaceCatalog || [];
      if (sameCatalog(baseCatalog, remoteCatalog) || sameCatalog(baseCatalog, localCatalog)) return result;

      const settlement = result.settlement || {};
      return {
        ...result,
        settlement: {
          ...settlement,
          routePlaceCatalog: mergeRoutePlaceCatalog(baseCatalog, remoteCatalog, localCatalog),
        },
      };
    },
  });
}

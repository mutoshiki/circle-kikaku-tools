export const APP_SCHEMA_VERSION = 2;

export function migrateAppData(rawData) {
  const data = rawData && typeof rawData === "object" ? rawData : {};
  const version = Number(data.schemaVersion || 1);
  const migrated = { ...data };

  if (version < 2) {
    migrated.schemaVersion = 2;
    migrated.meta = {
      ...(migrated.meta || {}),
      migratedAt: new Date().toISOString(),
      migratedFrom: version
    };
  }

  if (!migrated.schemaVersion) migrated.schemaVersion = APP_SCHEMA_VERSION;
  return migrated;
}

import {customType} from 'drizzle-orm/pg-core';

/**
 * Binary column; every business payload is stored encrypted (AES-256-GCM). Postgres.js returns a Buffer, PGlite
 * (local demo database) a plain Uint8Array: both come out as a Buffer.
 */
export const bytea = customType<{data: Buffer; driverData: Buffer | Uint8Array}>({
    dataType: () => 'bytea',
    fromDriver: (value) => (Buffer.isBuffer(value) ? value : Buffer.from(value)),
});

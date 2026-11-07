import {customType} from 'drizzle-orm/pg-core';

/** Binary column; every business payload is stored encrypted (AES-256-GCM). */
export const bytea = customType<{data: Buffer; driverData: Buffer}>({dataType: () => 'bytea'});

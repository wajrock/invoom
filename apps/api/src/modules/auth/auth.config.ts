export const RP_NAME = 'Invoom';

export const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const EMAIL_TOKEN_TTL_MS = 30 * 60 * 1000;

/** Per-IP lockout: 15 min after 5 failures, doubling up to 24 h. */
export const IP_MAX_FAILURES = 5;
export const IP_BASE_LOCK_MS = 15 * 60 * 1000;
export const MAX_LOCK_MS = 24 * 3600 * 1000;

/** Global cap across all IPs, against distributed guessing. */
export const GLOBAL_MAX_FAILURES = 200;
export const GLOBAL_WINDOW_MS = 24 * 3600 * 1000;
export const GLOBAL_LOCK_MS = 60 * 60 * 1000;

export const MAIL_PER_ADDRESS = {max: 3, windowMs: 3600 * 1000};
export const MAIL_PER_IP = {max: 10, windowMs: 3600 * 1000};

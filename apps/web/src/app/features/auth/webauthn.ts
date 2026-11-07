/** Readable message for browser WebAuthn errors (cancelled, unsupported device…), or null. */
export function webauthnError(err: unknown): string | null {
    if (!(err instanceof Error)) return null;
    // SimpleWebAuthn wraps the browser error: look at the cause too
    const name = (err.cause instanceof Error ? err.cause.name : '') || err.name;
    if (name === 'NotAllowedError' || name === 'AbortError') return 'Opération annulée ou expirée.';
    if (name === 'InvalidStateError') return 'Cet appareil a déjà une passkey enregistrée.';
    if (name === 'NotSupportedError' || name === 'SecurityError')
        return 'Les passkeys ne sont pas disponibles dans ce navigateur.';
    return null;
}

/** Default name suggested for this device's passkey. */
export function guessDeviceName(): string {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
    if (/Android/.test(ua)) return 'Android';
    if (/Macintosh/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'PC Windows';
    return 'Cet appareil';
}

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

/**
 * Tells the device's password manager that these passkeys no longer exist on the server, so it stops offering them
 * (WebAuthn Signal API). Best effort: only recent browsers support it, and the user can always remove them by hand.
 */
export function forgetPasskeys(credentialIds: string[]) {
    if (typeof PublicKeyCredential === 'undefined') return;
    const signal = (
        PublicKeyCredential as unknown as {
            signalUnknownCredential?: (o: {rpId: string; credentialId: string}) => Promise<void>;
        }
    ).signalUnknownCredential;
    if (!signal) return;
    for (const credentialId of credentialIds) {
        signal.call(PublicKeyCredential, {rpId: location.hostname, credentialId}).catch(() => undefined);
    }
}

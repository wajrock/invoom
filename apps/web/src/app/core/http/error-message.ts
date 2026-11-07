import {HttpErrorResponse} from '@angular/common/http';

/** Human-readable message for an API or runtime error. */
export function errorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
        if (err.status === 0) return 'Serveur injoignable';
        const body = err.error as {error?: string} | null;
        return body?.error ?? `Erreur ${err.status}`;
    }
    return err instanceof Error ? err.message : 'Erreur inattendue';
}

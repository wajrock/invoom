import type {CanDeactivateFn} from '@angular/router';

/** A page that can hold unsaved changes; it asks itself, so the confirmation dialog stays out of the main bundle */
export interface HasUnsavedChanges {
    canLeave(): boolean | Promise<boolean>;
}

/** Route guard: lets the page ask before it is left with unsaved changes */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (page) => page.canLeave();

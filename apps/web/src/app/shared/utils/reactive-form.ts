import {signal} from '@angular/core';

/**
 * Plain-looking form object whose fields are backed by signals.
 *
 * Components are OnPush by default: when several components bind to one shared form with ngModel, a field
 * edited in one would not refresh the others. Reading a field through these accessors is tracked like a signal,
 * and assigning it (ngModel, Object.assign) notifies every view that reads it.
 */
export function reactiveForm<T extends object>(initial: T): T {
    const form = {} as T;
    for (const key of Object.keys(initial) as (keyof T)[]) {
        const value = signal(initial[key]);
        Object.defineProperty(form, key, {
            enumerable: true,
            get: () => value(),
            set: (v: T[keyof T]) => value.set(v),
        });
    }
    return form;
}

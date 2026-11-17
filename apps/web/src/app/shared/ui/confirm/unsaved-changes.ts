import {afterNextRender, inject} from '@angular/core';
import {BrnDialogRef} from '@spartan-ng/brain/dialog';
import {Confirm} from './confirm';

/**
 * Asks before a form dialog closes with unsaved changes, whichever way it closes (Cancel, the cross, Escape, a
 * click outside): they all go through the dialog's close(). `state` returns what the form edits; it is compared with
 * its value after the first render, or at `markPristine()` for a form filled in later.
 * Call in the dialog's constructor, and close with `closeSaved` once saved.
 */
export function guardUnsavedChanges<R>(state: () => unknown) {
    const ref = inject<BrnDialogRef<R>>(BrnDialogRef);
    const confirm = inject(Confirm);
    const close = ref.close.bind(ref);
    let pristine: string | undefined;
    let asking = false;

    const markPristine = () => {
        pristine = JSON.stringify(state());
    };
    afterNextRender(markPristine);

    ref.close = (result?: R) => {
        if (pristine === undefined || JSON.stringify(state()) === pristine) return close(result);
        if (asking) return;
        asking = true;
        void confirm.discardChanges().then((ok) => {
            asking = false;
            if (ok) close(result);
        });
    };
    return {closeSaved: close, markPristine};
}

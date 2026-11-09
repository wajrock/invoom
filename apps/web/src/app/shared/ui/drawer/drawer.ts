import type {HlmDialogOptions} from '@spartan-ng/helm/dialog';

/**
 * Turns an HlmDialogService dialog into a full-height panel sliding in from the right (from `sm`).
 * Phones keep the bottom sheet from the dialog's base styles.
 */
const DRAWER_CLASS = [
    'sm:fixed sm:inset-y-3 sm:right-3 sm:left-auto sm:h-auto sm:w-[calc(100%-1.5rem)] sm:mx-0',
    'sm:grid-rows-[auto_minmax(0,1fr)_auto] sm:rounded-2xl sm:shadow-2xl',
    // One column no wider than the panel, so long titles truncate instead of widening it
    'grid-cols-[minmax(0,1fr)]',
    'sm:data-open:zoom-in-100 sm:data-closed:zoom-out-100 sm:data-open:fade-in-100 sm:data-closed:fade-out-100',
    'sm:data-open:slide-in-from-right sm:data-closed:slide-out-to-right sm:duration-300 sm:ease-out',
    // Full-width rules between header, scrolling body and footer
    // Header and footer carry their own even padding, so the panel has none at the top and bottom
    'gap-0 max-sm:gap-0 sm:py-0 [&_form]:py-5',
    'sm:[&_hlm-dialog-header]:pt-4 sm:[&_hlm-dialog-footer]:pb-4',
    '[&_hlm-dialog-header]:-mx-6 [&_hlm-dialog-header]:border-b [&_hlm-dialog-header]:px-6 [&_hlm-dialog-header]:pb-4',
    '[&_hlm-dialog-footer]:-mx-6 [&_hlm-dialog-footer]:border-t [&_hlm-dialog-footer]:px-6 [&_hlm-dialog-footer]:pt-4',
    'max-sm:[&_hlm-dialog-header]:-mx-4 max-sm:[&_hlm-dialog-header]:px-4',
    // Header row 40px high (avatar size), so the close button (top-5 in the dialog) sits on its centre line
    '[&_hlm-dialog-header>h2]:flex [&_hlm-dialog-header>h2]:min-h-10 [&_hlm-dialog-header>h2]:items-center',
    '[&_hlm-dialog-header]:pr-12 max-sm:[&_hlm-dialog-header]:pr-12',
    'max-sm:[&_hlm-dialog-footer]:-mx-4 max-sm:[&_hlm-dialog-footer]:px-4',
].join(' ');

const WIDTHS = {default: 'sm:max-w-md', wide: 'sm:max-w-2xl'} as const;

/** Options for `HlmDialogService.open` rendering the component as a right drawer. */
export function drawerOptions<T>(context: T, width: keyof typeof WIDTHS = 'default'): Partial<HlmDialogOptions<T>> {
    return {context, contentClass: `${DRAWER_CLASS} ${WIDTHS[width]}`, closeLabel: 'Fermer'};
}

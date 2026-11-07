import {toast} from '@spartan-ng/brain/sonner';

/** Copies to the clipboard and confirms with a toast. */
export async function copyToClipboard(text: string, what = 'Copié'): Promise<void> {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(`${what} dans le presse-papiers`);
    } catch {
        toast.error('Copie impossible');
    }
}

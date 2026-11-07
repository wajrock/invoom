import {Component, input, output, signal} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideCheck, lucideCopy, lucideDownload} from '@ng-icons/lucide';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';

/** One-time display of the recovery codes, with copy and download. */
@Component({
    selector: 'app-recovery-codes',
    imports: [NgIcon, HlmButtonImports],
    providers: [provideIcons({lucideCopy, lucideDownload, lucideCheck})],
    templateUrl: './recovery-codes.html',
})
export class RecoveryCodes {
    readonly codes = input.required<string[]>();
    readonly done = output<void>();
    protected readonly saved = signal(false);

    private text() {
        return `Codes de récupération Invoom — ${new Date().toLocaleDateString('fr-FR')}\nChaque code ne fonctionne qu'une fois.\n\n${this.codes().join('\n')}\n`;
    }

    async copy() {
        try {
            await navigator.clipboard.writeText(this.text());
            toast.success('Codes copiés');
        } catch {
            toast.error('Copie impossible, sélectionne les codes à la main');
        }
    }

    download() {
        const url = URL.createObjectURL(new Blob([this.text()], {type: 'text/plain'}));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'invoom-codes-de-recuperation.txt';
        a.click();
        URL.revokeObjectURL(url);
    }
}

import {Component, inject} from '@angular/core';
import {BackButton} from '../back-button';
import {LoginFlow} from '../login-flow';

@Component({
    selector: 'app-email-sent-step',
    imports: [BackButton],
    host: {class: 'contents'},
    template: `
        <p class="text-sm">
            Si l'adresse <b>{{ flow.email().trim() }}</b> est valide, un lien vient d'y être envoyé. Il est valable 30
            minutes : ouvre-le sur l'appareil avec lequel tu veux te connecter.
        </p>
        <p class="text-muted-foreground text-xs">
            Rien reçu ? Vérifie les indésirables, puis réessaie dans quelques minutes.
        </p>
        <app-back-button label="Retour à la connexion" />
    `,
})
export class EmailSentStep {
    protected readonly flow = inject(LoginFlow);
}

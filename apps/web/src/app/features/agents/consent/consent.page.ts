import {Component, inject, signal} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideBookOpen, lucidePencil, lucideShieldCheck} from '@ng-icons/lucide';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {errorMessage} from '../../../core/http/error-message';
import {Logo} from '../../../shared/ui/logo/logo';
import {Spinner} from '../../../shared/ui/spinner/spinner';
import {AgentsApi, type AgentClient, type ConsentRequest} from '../agents.api';

/**
 * Consent to an agent (e.g. Claude) asking for access through OAuth. The API has already checked the request
 * (/oauth/authorize); the decision goes back to the agent's own address, which the API checks again.
 */
@Component({
    selector: 'app-consent',
    imports: [NgIcon, HlmButtonImports, Logo, Spinner],
    providers: [provideIcons({lucideBookOpen, lucidePencil, lucideShieldCheck})],
    templateUrl: './consent.page.html',
})
export class ConsentPage {
    private readonly api = inject(AgentsApi);
    private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;

    private readonly request: ConsentRequest = {
        client_id: this.query.get('client_id') ?? '',
        redirect_uri: this.query.get('redirect_uri') ?? '',
        code_challenge: this.query.get('code_challenge') ?? '',
        state: this.query.get('state') ?? undefined,
    };

    protected readonly client = signal<AgentClient | null>(null);
    protected readonly error = signal('');
    protected readonly busy = signal(false);

    constructor() {
        void this.load();
    }

    private async load() {
        try {
            this.client.set(await this.api.client(this.request.client_id, this.request.redirect_uri));
        } catch (err) {
            this.error.set(errorMessage(err));
        }
    }

    protected async decide(approve: boolean) {
        this.busy.set(true);
        try {
            const {redirect} = await this.api.decide(this.request, approve);
            // Leaves the app for the agent's address: a full page load, not an in-app navigation
            location.assign(redirect);
        } catch (err) {
            this.error.set(errorMessage(err));
            this.busy.set(false);
        }
    }
}

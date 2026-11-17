import {Component, inject, signal} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideBot} from '@ng-icons/lucide';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmCardImports} from '@spartan-ng/helm/card';
import {errorMessage} from '../../core/http/error-message';
import {FrDatePipe} from '../../shared/pipes/fr-date.pipe';
import {AgentsApi, type AgentConnection} from './agents.api';

/** Agents connected to the workspace (Claude…), each revocable; shown in the security settings */
@Component({
    selector: 'app-agent-connections',
    imports: [NgIcon, HlmButtonImports, HlmCardImports, FrDatePipe],
    providers: [provideIcons({lucideBot})],
    template: `
        <section hlmCard>
            <div hlmCardHeader>
                <h2 hlmCardTitle>Agents connectés</h2>
                <p hlmCardDescription>
                    Assistants comme Claude autorisés à consulter et modifier ton espace, jusqu'à ce que tu les
                    révoques.
                </p>
            </div>
            <div hlmCardContent>
                @if (connections(); as list) {
                    @if (list.length) {
                        <ul class="divide-y rounded-lg border">
                            @for (a of list; track a.id) {
                                <li class="flex items-center gap-3 py-3 pr-2 pl-4">
                                    <ng-icon name="lucideBot" class="text-muted-foreground shrink-0 text-lg" />
                                    <div class="min-w-0 flex-1">
                                        <p class="truncate font-medium">{{ a.name }}</p>
                                        <p class="text-muted-foreground text-xs">
                                            Autorisé le {{ a.createdAt | frDate: 'short' }} · utilisé le
                                            {{ a.lastUsedAt | frDate: 'short' }}
                                        </p>
                                    </div>
                                    <button
                                        hlmBtn
                                        variant="ghost"
                                        size="sm"
                                        class="text-destructive shrink-0"
                                        [disabled]="busy()"
                                        (click)="revoke(a)"
                                    >
                                        Révoquer
                                    </button>
                                </li>
                            }
                        </ul>
                    } @else {
                        <p class="text-muted-foreground text-sm">
                            Aucun agent connecté. Ajoute Invoom comme connecteur dans Claude avec l'adresse
                            <span class="text-foreground font-mono text-xs break-all">{{ mcpUrl }}</span
                            >.
                        </p>
                    }
                }
            </div>
        </section>
    `,
})
export class AgentConnections {
    private readonly api = inject(AgentsApi);

    protected readonly connections = signal<AgentConnection[] | null>(null);
    protected readonly busy = signal(false);
    protected readonly mcpUrl = `${location.origin}/mcp`;

    constructor() {
        void this.load();
    }

    private async load() {
        try {
            this.connections.set(await this.api.connections());
        } catch (err) {
            toast.error(errorMessage(err));
        }
    }

    protected async revoke(a: AgentConnection) {
        if (!confirm(`Révoquer l'accès de ${a.name} ? Il devra être autorisé à nouveau.`)) return;
        this.busy.set(true);
        try {
            await this.api.revoke(a.id);
            toast.success('Accès révoqué');
            await this.load();
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            this.busy.set(false);
        }
    }
}

import {Component, inject, signal} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideBot} from '@ng-icons/lucide';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {errorMessage} from '../../core/http/error-message';
import {FrDatePipe} from '../../shared/pipes/fr-date.pipe';
import {AgentsApi, type AgentConnection} from './agents.api';

/** Agents connected to the workspace (Claude…), each revocable; listed in the security settings */
@Component({
    selector: 'app-agent-connections',
    imports: [NgIcon, HlmButtonImports, FrDatePipe],
    providers: [provideIcons({lucideBot})],
    template: `
        @if (connections(); as list) {
            <div class="settings-card divide-y">
                @for (a of list; track a.id) {
                    <div class="flex items-center gap-3 px-4 py-3">
                        <span class="bg-muted text-muted-foreground grid size-9 shrink-0 place-items-center rounded-lg">
                            <ng-icon name="lucideBot" class="text-base" />
                        </span>
                        <div class="min-w-0 flex-1">
                            <p class="truncate text-sm font-medium">{{ a.name }}</p>
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
                    </div>
                } @empty {
                    <div class="grid gap-2 px-4 py-5 text-sm">
                        <p class="text-muted-foreground">
                            Aucun agent connecté. Ajoute Invoom comme connecteur dans Claude avec l'adresse :
                        </p>
                        <code class="bg-muted rounded-md px-2.5 py-1.5 font-mono text-xs break-all">{{ mcpUrl }}</code>
                    </div>
                }
            </div>
        }
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

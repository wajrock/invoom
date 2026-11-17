import {inject, Injectable} from '@angular/core';
import {ApiClient} from '../../core/http/api-client';

/** Agent (MCP client) asking for access, as the consent page shows it */
export interface AgentClient {
    name: string;
    redirectHost: string;
}

/** An agent connected to the workspace; it keeps access until revoked */
export interface AgentConnection {
    id: string;
    name: string;
    createdAt: string;
    lastUsedAt: string;
}

export interface ConsentRequest {
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
    state?: string;
}

@Injectable({providedIn: 'root'})
export class AgentsApi {
    private readonly api = inject(ApiClient);

    client(clientId: string, redirectUri: string) {
        return this.api.get<AgentClient>('/api/auth/agents/client', {client_id: clientId, redirect_uri: redirectUri});
    }

    /** Where to send the browser back to the agent, with the code or the refusal */
    decide(request: ConsentRequest, approve: boolean) {
        return this.api.post<{redirect: string}>('/api/auth/agents/decision', {...request, approve});
    }

    connections() {
        return this.api.get<AgentConnection[]>('/api/auth/agents/connections');
    }

    revoke(id: string) {
        return this.api.delete(`/api/auth/agents/connections/${id}`);
    }
}

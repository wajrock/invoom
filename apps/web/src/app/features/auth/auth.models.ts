export interface PasskeyInfo {
    id: string;
    name: string;
    createdAt: string;
    lastUsedAt: string | null;
}

export interface PasskeyState {
    passkeys: PasskeyInfo[];
    recoveryCodesRemaining: number;
}

export interface EmailLink {
    purpose: 'signup' | 'recover';
    email: string;
}

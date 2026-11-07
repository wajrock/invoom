export interface PlatformInput {
    name: string;
    url: string;
    category: string;
    description: string;
    login: string;
}

export interface Platform extends PlatformInput {
    id: string;
    position: number;
}

/** Host name of a URL, or '' when invalid */
export function hostOf(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return '';
    }
}

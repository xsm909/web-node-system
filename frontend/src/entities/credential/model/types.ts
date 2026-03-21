export interface Credential {
    id: string;
    key: string;
    value: string;
    type: string;
    description: string | null;
    is_locked: boolean;
}

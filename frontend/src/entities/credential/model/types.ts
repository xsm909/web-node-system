export interface Credential {
    id: string;
    key: string;
    value: string;
    type: string;
    auth_type?: 'header' | 'query';
    meta?: any;
    description: string | null;
    is_locked: boolean;
    expired: boolean;
}

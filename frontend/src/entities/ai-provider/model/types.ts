export interface AiProvider {
    id: string;
    key: string;
    models: any;
    api_key?: string | null;
    description?: string | null;
}

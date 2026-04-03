export interface AiProviderModel {
    name: string;
    base_url?: string;
}

export interface AiProviderModels {
    models: (string | AiProviderModel)[];
}

export interface AiProvider {
    id: string;
    key: string;
    models: AiProviderModels;
    api_key: string | null;
    base_url?: string;
    description: string | null;
}

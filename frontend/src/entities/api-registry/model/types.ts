export interface ApiFunction {
    name: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    path: string;
    description?: string;
    parameters?: any; // JSON Schema for parameters
    default_params?: Array<{ key: string; value: string }>;
}

export interface ApiRegistry {
    id: string;
    name: string;
    base_url: string;
    credential_key?: string | null;
    functions?: ApiFunction[] | null;
    description?: string | null;
    project_id?: string | null;
}

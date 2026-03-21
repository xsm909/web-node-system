export interface AITask {
    id: string;
    owner_id: string;
    data_type_id: number;
    ai_model: string;
    description?: string;
    task: Record<string, any> | null;
    created_by?: string;
    updated_by?: string;
    created_at?: string;
    updated_at?: string;
    is_locked?: boolean;
}

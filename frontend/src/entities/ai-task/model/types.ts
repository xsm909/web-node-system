export interface AITask {
    id: string;
    owner_id: string;
    category: string;
    ai_model: string;
    task: {
        Task: string;
        [key: string]: any;
    } | null;
    created_by?: string;
    updated_by?: string;
    created_at?: string;
    updated_at?: string;
}

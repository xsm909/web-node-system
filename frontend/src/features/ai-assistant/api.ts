import { apiClient } from '../../shared/api/client';

export interface AIGenerateRequest {
    prompt: string;
    hint_type: string;
    model?: string;
    is_modify?: boolean;
    context?: any;
}

export interface AIGenerateResponse {
    result: any;
}

export const generateAIContent = async (data: AIGenerateRequest) => {
    const response = await apiClient.post<AIGenerateResponse>('/ai/generate', data);
    return response.data;
};

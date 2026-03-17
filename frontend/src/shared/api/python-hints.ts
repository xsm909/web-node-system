import { apiClient } from "./client";

export interface PythonHint {
    label: string;
    type: string;
    detail: string;
    boost?: number;
    snippet?: string;
}

export const getPythonHints = async (): Promise<PythonHint[]> => {
    try {
        const response = await apiClient.get<PythonHint[]>("/python-hints/");
        return response.data;
    } catch (error) {
        console.error("Failed to fetch python hints", error);
        return [];
    }
};

export interface Project {
    id: string;
    key: string;
    name: string;
    description: string | null;
    owner_id: string;
    theme_color: string | null;
    category: string;
    is_locked: boolean;
}

export interface ProjectCreate {
    key: string;
    name: string;
    description?: string;
    owner_id: string;
    theme_color?: string;
    category?: string;
}

export interface ProjectUpdate {
    name?: string;
    description?: string | null;
    theme_color?: string | null;
    category?: string;
}

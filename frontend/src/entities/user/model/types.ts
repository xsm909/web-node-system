export interface AssignedUser {
    id: string;
    username: string;
}

export interface User {
    id: string;
    username: string;
    role: string;
    is_locked: boolean;
    assigned_managers?: User[];
}

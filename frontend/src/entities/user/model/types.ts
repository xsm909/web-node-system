export interface AssignedUser {
    id: string;
    username: string;
}

export interface User {
    id: string;
    username: string;
    role: string;
    assigned_managers?: User[];
}

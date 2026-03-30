import { create } from 'zustand';
import type { AssignedUser } from '../../../entities/user/model/types';

interface ClientState {
    activeClientId: string | null;
    assignedUsers: AssignedUser[];
    setActiveClientId: (id: string | null) => void;
    setAssignedUsers: (users: AssignedUser[]) => void;
}

export const useClientStore = create<ClientState>((set, get) => ({
    activeClientId: null,
    assignedUsers: [],
    setActiveClientId: (id) => {
        if (get().activeClientId === id) return;
        set({ activeClientId: id });
    },
    setAssignedUsers: (users) => {
        const current = get().assignedUsers;
        if (current.length === users.length && JSON.stringify(current) === JSON.stringify(users)) {
            return;
        }
        set({ assignedUsers: users });
    },
}));

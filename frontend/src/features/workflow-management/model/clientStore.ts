import { create } from 'zustand';
import type { AssignedUser } from '../../../entities/user/model/types';

interface ClientState {
    activeClientId: string | null;
    assignedUsers: AssignedUser[];
    setActiveClientId: (id: string | null) => void;
    setAssignedUsers: (users: AssignedUser[]) => void;
}

export const useClientStore = create<ClientState>((set) => ({
    activeClientId: null,
    assignedUsers: [],
    setActiveClientId: (id) => set({ activeClientId: id }),
    setAssignedUsers: (users) => set({ assignedUsers: users }),
}));

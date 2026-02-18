import type { AssignedUser } from '../../../entities/user/model/types';
import styles from './UserList.module.css';

interface UserListProps {
    users: AssignedUser[];
    selectedUserId?: number;
    onSelect: (user: AssignedUser) => void;
}

export function UserList({ users, selectedUserId, onSelect }: UserListProps) {
    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>My Users</h3>
            {users.map((u) => (
                <button
                    key={u.id}
                    className={selectedUserId === u.id ? styles.activeItem : styles.item}
                    onClick={() => onSelect(u)}
                >
                    👤 {u.username}
                </button>
            ))}
        </div>
    );
}

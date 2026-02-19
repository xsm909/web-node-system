import type { AssignedUser } from '../../../entities/user/model/types';
import styles from './ManagerUserList.module.css';

interface ManagerUserListProps {
    users: AssignedUser[];
    selectedUserId?: string;
    onSelect: (user: AssignedUser) => void;
}

export function ManagerUserList({ users, selectedUserId, onSelect }: ManagerUserListProps) {
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

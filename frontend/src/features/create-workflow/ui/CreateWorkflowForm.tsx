import { useState } from 'react';
import styles from './CreateWorkflowForm.module.css';

interface CreateWorkflowFormProps {
    onCreate: (name: string) => Promise<void>;
    isCreating?: boolean;
}

export function CreateWorkflowForm({ onCreate, isCreating }: CreateWorkflowFormProps) {
    const [name, setName] = useState('');

    const handleSubmit = async () => {
        if (!name || isCreating) return;
        await onCreate(name);
        setName('');
    };

    return (
        <div className={styles.createForm}>
            <input
                type="text"
                placeholder="Workflow name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.createInput}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <button
                onClick={handleSubmit}
                disabled={isCreating || !name}
                className={styles.createBtn}
            >
                {isCreating ? '...' : '+'}
            </button>
        </div>
    );
}

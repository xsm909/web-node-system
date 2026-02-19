import type { Workflow } from '../../../entities/workflow/model/types';
import styles from './WorkflowList.module.css';

interface WorkflowListProps {
    workflows: Workflow[];
    activeWorkflowId?: number;
    onSelect: (wf: Workflow) => void;
    onDelete: (wf: Workflow) => void;
}

export function WorkflowList({ workflows, activeWorkflowId, onSelect, onDelete }: WorkflowListProps) {
    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Workflows</h3>
            {workflows.map((wf) => (
                <div
                    key={wf.id}
                    className={activeWorkflowId === wf.id ? styles.activeItem : styles.item}
                    onClick={() => onSelect(wf)}
                >
                    <span className={styles.name}>📋 {wf.name}</span>
                    <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDelete(wf);
                        }}
                        aria-label="Delete"
                    >
                        🗑️
                    </button>
                </div>
            ))}
        </div>
    );
}

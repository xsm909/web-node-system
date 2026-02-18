import type { Workflow } from '../../../entities/workflow/model/types';
import styles from './WorkflowList.module.css';

interface WorkflowListProps {
    workflows: Workflow[];
    activeWorkflowId?: number;
    onSelect: (wf: Workflow) => void;
}

export function WorkflowList({ workflows, activeWorkflowId, onSelect }: WorkflowListProps) {
    return (
        <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Workflows</h3>
            {workflows.map((wf) => (
                <button
                    key={wf.id}
                    className={activeWorkflowId === wf.id ? styles.activeItem : styles.item}
                    onClick={() => onSelect(wf)}
                >
                    📋 {wf.name}
                </button>
            ))}
        </div>
    );
}

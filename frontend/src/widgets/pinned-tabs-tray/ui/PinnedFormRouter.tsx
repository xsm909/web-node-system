import React, { useState, useEffect } from 'react';
import { usePinStore, type PinnedTab } from '../../../features/pinned-tabs/model/store';
import type { Project } from '../../../entities/project/model/types';
import { SchemaManagement } from '../../schema-management/ui/SchemaManagement';
import { NodeTypeFormView } from '../../node-type-form-modal/ui/NodeTypeFormModal';
import { WorkflowManagement } from '../../common-workflow-management';
import { ReportManagement } from '../../report-management/ui/ReportManagement';
import { AgentHintManagement } from '../../agent-hint-management/ui/AgentHintManagement';
import { useNodeTypeManagement } from '../../../features/node-type-management';
import { apiClient } from '../../../shared/api/client';

import { useProjects } from '../../../entities/project/api';

export const PinnedFormRouter: React.FC = () => {
    const { activeTabId, tabs, focus } = usePinStore();
    const { data: projects = [] } = useProjects();
    
    if (tabs.length === 0) return null;

    const onClose = () => focus(null);

    return (
        <div className="flex-1 h-full flex flex-col overflow-hidden">
            {tabs.map((tab) => (
                <div 
                    key={tab.id}
                    className={`flex-1 flex-col h-full overflow-hidden ${tab.id === activeTabId ? 'flex' : 'hidden'}`}
                >
                    <PinnedTabContent 
                        tab={tab} 
                        projects={projects} 
                        onClose={onClose} 
                    />
                </div>
            ))}
        </div>
    );
};

interface PinnedTabContentProps {
    tab: PinnedTab;
    projects: Project[];
    onClose: () => void;
}

const PinnedTabContent: React.FC<PinnedTabContentProps> = ({ tab, projects, onClose }) => {
    const activeProject = tab.projectId ? projects.find((p: Project) => p.id === tab.projectId) : null;
    const brandColor = activeProject?.theme_color || null;
    
    const content = (() => {
        switch (tab.entityType) {
            case 'schemas':
                return (
                    <SchemaManagement 
                        initialEditId={tab.entityId} 
                        onClose={onClose} 
                        projectId={tab.projectId ?? null}
                    />
                );
                
            case 'node_types':
                return (
                    <NodeTypeFormContainer 
                        entityId={tab.entityId} 
                        onClose={onClose} 
                        projectId={tab.projectId ?? null}
                    />
                );
                
            case 'workflows':
                return (
                    <WorkflowManagement 
                        activeWorkflowId={tab.entityId} 
                        onToggleSidebar={() => {}} 
                        isSidebarOpen={false}
                        projectId={tab.projectId ?? null}
                    />
                );
                
            case 'reports':
                return (
                    <ReportManagement 
                        initialEditId={tab.entityId} 
                        onClose={onClose} 
                        projectId={tab.projectId ?? null}
                    />
                );
                
            case 'agent_hints':
                return (
                    <AgentHintManagement 
                        initialEditId={tab.entityId} 
                        onClose={onClose} 
                        projectId={tab.projectId ?? null}
                    />
                );

            default:
                return (
                    <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
                        Unknown entity type: {tab.entityType}
                    </div>
                );
        }
    })();

    return (
        <div 
            className="flex-1 h-full flex flex-col overflow-hidden"
            style={brandColor ? { 
                '--brand': brandColor,
                '--brand-hover': brandColor
            } as React.CSSProperties : {}}
        >
            {content}
        </div>
    );
};

// Helper to handle async deps for Node Type Form
const NodeTypeFormContainer: React.FC<{ 
    entityId: string; 
    onClose: () => void; 
    projectId?: string | null;
}> = ({ entityId, onClose, projectId }) => {
    const { handleSave } = useNodeTypeManagement();
    const [node, setNode] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiClient.get(`/admin/node-types`).then(({ data }: any) => {
            const found = data.find((n: any) => n.id === entityId);
            setNode(found);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [entityId]);

    if (loading) return <div className="p-8 text-[var(--text-muted)]">Loading node...</div>;
    if (!node) return <div className="p-8 text-[var(--text-muted)]">Node not found.</div>;

    return (
        <NodeTypeFormView 
            editingNode={node}
            onClose={onClose}
            onSave={(data) => handleSave(data, node.id)}
            projectId={projectId}
        />
    );
};

import React, { useState, useEffect } from 'react';
import { usePinStore } from '../../../features/pinned-tabs/model/store';
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
    
    const activeTab = tabs.find(t => t.id === activeTabId);
    
    if (!activeTab) return null;

    const onClose = () => focus(null);

    const activeProject = activeTab.projectId ? projects.find(p => p.id === activeTab.projectId) : null;
    const brandColor = activeProject?.theme_color || null;
    
    const content = (() => {
        switch (activeTab.entityType) {
            case 'schemas':
                return (
                    <SchemaManagement 
                        initialEditId={activeTab.entityId} 
                        key={activeTab.id} 
                        onClose={onClose} 
                        projectId={activeTab.projectId ?? null}
                    />
                );
                
            case 'node_types':
                return (
                    <NodeTypeFormContainer 
                        entityId={activeTab.entityId} 
                        onClose={onClose} 
                        key={activeTab.id} 
                        projectId={activeTab.projectId ?? null}
                    />
                );
                
            case 'workflows':
                return (
                    <WorkflowManagement 
                        activeWorkflowId={activeTab.entityId} 
                        onToggleSidebar={() => {}} 
                        isSidebarOpen={false}
                        key={activeTab.id}
                        projectId={activeTab.projectId ?? null}
                    />
                );
                
            case 'reports':
                return (
                    <ReportManagement 
                        initialEditId={activeTab.entityId} 
                        key={activeTab.id} 
                        onClose={onClose} 
                        projectId={activeTab.projectId ?? null}
                    />
                );
                
            case 'agent_hints':
                return (
                    <AgentHintManagement 
                        initialEditId={activeTab.entityId} 
                        key={activeTab.id} 
                        onClose={onClose} 
                        projectId={activeTab.projectId ?? null}
                    />
                );

            default:
                return (
                    <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
                        Unknown entity type: {activeTab.entityType}
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

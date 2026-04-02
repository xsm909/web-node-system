import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePinStore, type PinnedTab } from '../../../features/pinned-tabs/model/store';
import type { Project } from '../../../entities/project/model/types';
import { SchemaManagement } from '../../schema-management/ui/SchemaManagement';
import { NodeTypeFormView } from '../../node-type-form-modal/ui/NodeTypeFormModal';
import { WorkflowManagement } from '../../common-workflow-management';
import { ReportManagement } from '../../report-management/ui/ReportManagement';
import { AgentHintManagement } from '../../agent-hint-management/ui/AgentHintManagement';
import { ApiManagement } from '../../api-management/ui/ApiManagement';
import { UserManagement } from '../../user-management/ui/UserManagement';
import { ProjectManagement } from '../../project-management/ui/ProjectManagement';
import { useNodeTypeManagement } from '../../../features/node-type-management';
import { apiClient } from '../../../shared/api/client';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import type { NodeType } from '../../../entities/node-type/model/types';
import { useProjects } from '../../../entities/project/api';

export const PinnedFormRouter: React.FC = () => {
    const activeTabId = usePinStore(s => s.activeTabId);
    const tabs = usePinStore(s => s.tabs);
    const focus = usePinStore(s => s.focus);
    
    const { data: projects = [] } = useProjects();
    const [editingNodeForModal, setEditingNodeForModal] = useState<NodeType | null>(null);
    const [allNodes, setAllNodes] = useState<NodeType[]>([]);
    const [refreshCount, setRefreshCount] = useState(0);
    const [isModalDirty, setIsModalDirty] = useState(false);
    const closeNodeModal = useCallback(() => {
        console.log('[PinnedFormRouter] closeNodeModal called');
        console.trace(); // Find out who called this
        setEditingNodeForModal(null);
        setIsModalDirty(false);
    }, []);
    const modalFormSubmitRef = useRef<() => void>(null);

    const { handleSave: handleNodeSave, handleOpenModal: prepareNodeEdit } = useNodeTypeManagement();
    
    console.log('[PinnedFormRouter] Rendered. editingNodeForModal ID:', editingNodeForModal?.id, 'isModalDirty:', isModalDirty);
    
    // Handle node type list refresh
    useEffect(() => {
        apiClient.get(`/admin/node-types?t=${Date.now()}`).then(({ data }) => setAllNodes(data)).catch(() => { });
    }, [refreshCount]);

    const onClose = React.useCallback(() => focus(null), [focus]);

    const handleEditNodeFromWorkflow = React.useCallback((node: NodeType) => {
        // This makes sure the management logic prepares the state (locks etc)
        prepareNodeEdit(node);
        setEditingNodeForModal(node);
        setIsModalDirty(false); // Reset dirty state for new modal
    }, [prepareNodeEdit]);

    const handleModalDirtyChange = useCallback((val: boolean) => {
        if (val !== isModalDirty) {
            console.log('[PinnedFormRouter] isModalDirty CHANGING to:', val);
            setIsModalDirty(val);
        }
    }, [isModalDirty]);

    if (tabs.length === 0) return null;

    return (
        <div className="flex-1 h-full flex flex-col overflow-hidden relative">
            {tabs.map((tab) => (
                <div 
                    key={tab.id}
                    className={`flex-col h-full overflow-hidden ${tab.id === activeTabId ? 'flex-1 flex' : 'absolute inset-0 z-[-1] opacity-0 invisible pointer-events-none flex'}`}
                >
                    <PinnedTabContent 
                        tab={tab} 
                        projects={projects} 
                        onClose={onClose} 
                        isHotkeysEnabled={tab.id === activeTabId}
                        onEditNode={handleEditNodeFromWorkflow}
                        refreshTrigger={refreshCount}
                    />
                </div>
            ))}

            {editingNodeForModal && (
                <AppCompactModalForm
                    key={`modal-${editingNodeForModal.id}`}
                    isOpen={!!editingNodeForModal}
                    title={`Edit Node: ${editingNodeForModal.name}`}
                    icon="function"
                    onClose={closeNodeModal}
                    onSubmit={() => {
                        if (modalFormSubmitRef.current) {
                            modalFormSubmitRef.current();
                        }
                    }}
                    submitLabel="Save Changes"
                    width="max-w-[90%]"
                    fullHeight
                    noPadding
                    entityId={editingNodeForModal.id}
                    entityType="node_types"
                    initialLocked={editingNodeForModal.is_locked}
                    onLockToggle={(locked) => {
                        setEditingNodeForModal(prev => prev ? { ...prev, is_locked: locked } : prev);
                        setRefreshCount(r => r + 1);
                    }}
                    isDirty={isModalDirty}
                    allowedShortcuts={['f1', 'f4', 'f5']}
                >
                    <NodeTypeFormView
                        onClose={closeNodeModal}
                        editingNode={editingNodeForModal}
                        onSave={(data) => {
                            return handleNodeSave(data, data.id || editingNodeForModal.id, () => {
                                console.log('[PinnedFormRouter] handleSave SUCCESS. Modal SHOULD NOT close.');
                                setRefreshCount(r => r + 1);
                                setIsModalDirty(false);
                            });
                        }}
                        onRefresh={() => setRefreshCount(r => r + 1)}
                        onDirtyChange={handleModalDirtyChange}
                        allNodes={allNodes}
                        defaultTab="code"
                        hideHeader={true}
                        externalSubmitRef={modalFormSubmitRef as any}
                    />
                </AppCompactModalForm>
            )}
        </div>
    );
};

interface PinnedTabContentProps {
    tab: PinnedTab;
    projects: Project[];
    onClose: () => void;
    isHotkeysEnabled?: boolean;
    onEditNode?: (node: NodeType) => void;
    refreshTrigger?: number;
}

const PinnedTabContent = React.memo<PinnedTabContentProps>(({ 
    tab, 
    projects, 
    onClose, 
    isHotkeysEnabled,
    onEditNode,
    refreshTrigger
}) => {
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
                        isHotkeysEnabled={isHotkeysEnabled}
                    />
                );
                
            case 'node_types':
                return (
                    <NodeTypeFormContainer 
                        entityId={tab.entityId} 
                        onClose={onClose} 
                        projectId={tab.projectId ?? null}
                        isHotkeysEnabled={isHotkeysEnabled}
                    />
                );
                
            case 'workflows':
                return (
                    <WorkflowManagement 
                        activeWorkflowId={tab.entityId} 
                        onToggleSidebar={() => {}} 
                        isSidebarOpen={false}
                        projectId={tab.projectId ?? null}
                        isHotkeysEnabled={isHotkeysEnabled}
                        onEditNode={onEditNode}
                        refreshTrigger={refreshTrigger}
                        isPinned={true}
                    />
                );
                
            case 'reports':
                return (
                    <ReportManagement 
                        initialEditId={tab.entityId} 
                        onClose={onClose} 
                        projectId={tab.projectId ?? null}
                        isHotkeysEnabled={isHotkeysEnabled}
                    />
                );
                
            case 'agent_hints':
                return (
                    <AgentHintManagement 
                        initialEditId={tab.entityId} 
                        onClose={onClose} 
                        projectId={tab.projectId ?? null}
                        isHotkeysEnabled={isHotkeysEnabled}
                    />
                );

            case 'credentials':
                return (
                    <ApiManagement 
                        initialTab="credentials"
                        initialEditId={tab.entityId}
                        onToggleSidebar={() => {}}
                        isSidebarOpen={false}
                    />
                );

            case 'api_registry':
                return (
                    <ApiManagement 
                        initialTab="api_registry"
                        initialEditId={tab.entityId}
                        onToggleSidebar={() => {}}
                        isSidebarOpen={false}
                    />
                );

            case 'ai_providers':
                return (
                    <ApiManagement 
                        initialTab="providers"
                        initialEditId={tab.entityId}
                        onToggleSidebar={() => {}}
                        isSidebarOpen={false}
                    />
                );

            case 'users':
                return (
                    <UserManagement 
                        initialEditId={tab.entityId}
                    />
                );

            case 'projects':
                return (
                    <ProjectManagement 
                        ownerId="" // Resolved internally
                        initialEditId={tab.entityId}
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
});

const NodeTypeFormContainer: React.FC<{ 
    entityId: string; 
    onClose: () => void; 
    projectId?: string | null;
    isHotkeysEnabled?: boolean;
}> = ({ entityId, onClose, projectId, isHotkeysEnabled }) => {
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
            allNodes={[]}
            projectId={projectId}
            isHotkeysEnabled={isHotkeysEnabled}
        />
    );
};

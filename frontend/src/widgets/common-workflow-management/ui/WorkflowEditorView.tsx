import React, { useState, useCallback, useEffect } from 'react';
import type { Node } from 'reactflow';
import { AppFormView } from '../../../shared/ui/app-form-view/AppFormView';
import { WorkflowActions } from '../../../features/workflow-operations/ui/WorkflowActions';
import { WorkflowGraph } from '../../workflow-graph';
import { AppParametersView } from '../../../shared/ui/app-parameters-view/AppParametersView';
import { NodeEditorView } from '../../node-editor-view';
import { AppParameterSelectByTamplate } from '../../../shared/ui/app-parameter-select-by-tamplate';
import { Icon } from '../../../shared/ui/icon';
import { AppCompactModalForm } from '../../../shared/ui/app-compact-modal-form/AppCompactModalForm';
import { AppParameterListEditor } from '../../../shared/ui/app-parameter-list-editor';
import { AppConsole, AppConsoleLogLine, type ConsoleLog } from '../../../shared/ui/app-console';
import { useWorkflowEditor } from './WorkflowEditorProvider';
import { useHotkeys } from '../../../shared/lib/hotkeys/useHotkeys';
import { apiClient } from '../../../shared/api/client';

interface WorkflowEditorViewProps {
    onBack: () => void;
}

export const WorkflowEditorView: React.FC<WorkflowEditorViewProps> = ({ onBack }) => {
    const {
        activeWorkflow,
        nodeTypes,
        isSaving,
        isRunning,
        activeNodeIds,
        executionLogs,
        liveRuntimeData,
        isDirty,
        saveWorkflow,
        runWorkflow,
        onNodesChange,
        onEdgesChange,
        onEditNode,
        notifyChange,
        setActiveWorkflow,
        nodesRef,
        isAdmin,
        activeClientId,
        setIsConsoleVisible,
        isConsoleVisible
    } = useWorkflowEditor();

    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [isParamsExpanded, setIsParamsExpanded] = useState(false);
    const [isParametersModalOpen, setIsParametersModalOpen] = useState(false);
    const [modalParams, setModalParams] = useState<any[]>([]);
    const [paramOptions, setParamOptions] = useState<Record<string, any[]>>({});
    
    // Console state
    const [activeConsoleTab, setActiveConsoleTab] = useState<'logs' | 'runtime'>('logs');
    const [showSystemLogs, setShowSystemLogs] = useState(false);
    const [consoleHeight, setConsoleHeight] = useState(280);

    const handleToggleParams = useCallback(() => {
        setIsParamsExpanded(!isParamsExpanded);
    }, [isParamsExpanded]);

    const onOpenParameters = useCallback(() => {
        setModalParams(activeWorkflow?.parameters || []);
        setIsParametersModalOpen(true);
    }, [activeWorkflow?.parameters]);

    const handleParamsChange = useCallback((nodeId: string, params: any) => {
        const currentNodes = nodesRef.current || [];
        const updatedNodes = currentNodes.map((n: any) =>
            n.id === nodeId ? { ...n, data: { ...n.data, params } } : n
        );
        nodesRef.current = updatedNodes;
        setActiveWorkflow((prev: any) => {
            if (!prev) return prev;
            return { ...prev, graph: { ...prev.graph, nodes: updatedNodes } };
        });
        if (selectedNode?.id === nodeId) {
            setSelectedNode((prev: any) => prev ? { ...prev, data: { ...prev.data, params } } : prev);
        }
        notifyChange?.();
    }, [setActiveWorkflow, notifyChange, selectedNode?.id, nodesRef]);

    const handleNodeSelect = useCallback((node: Node | null) => {
        if (!node || !nodeTypes) {
            setSelectedNode(null);
            return;
        }
        const ntDef = nodeTypes.find((t: any) =>
            (node.data?.nodeTypeId && t.id === node.data.nodeTypeId) ||
            t.name.toLowerCase() === (node.data?.nodeType || node.data?.label || '').toLowerCase()
        );
        if (!ntDef || !ntDef.parameters?.length) {
            setSelectedNode(null);
            return;
        }
        setSelectedNode(node);
    }, [nodeTypes]);

    useEffect(() => {
        if (!isParamsExpanded && !isParametersModalOpen) return;

        const paramsToFetch = [
            ...(activeWorkflow?.parameters || []),
            ...(isParametersModalOpen ? modalParams : [])
        ].filter(p => p.parameter_type === 'select' && p.source);

        paramsToFetch.forEach((param: any) => {
            // Only fetch if not already in paramOptions or if it's from modalParams (where it might have changed)
            // For simplicity, we can just fetch if not already present
            if (paramOptions[param.parameter_name]) return;

            apiClient.post('/workflows/test-source', {
                source: param.source,
                value_field: param.value_field,
                label_field: param.label_field
            }).then(({ data }) => {
                if (data.options) {
                    setParamOptions(prev => ({ ...prev, [param.parameter_name]: data.options }));
                }
            }).catch(() => {});
        });
    }, [isParamsExpanded, isParametersModalOpen, activeWorkflow?.parameters, modalParams, paramOptions]);

    useHotkeys([
        {
            key: 'f5',
            description: 'Run Workflow',
            handler: (e: any) => {
                e.preventDefault();
                if (!isRunning && !isSaving) {
                    runWorkflow(() => setIsConsoleVisible(true), activeClientId);
                }
            }
        },
        {
            key: 'f2',
            description: 'Edit Node',
            enabled: nodesRef.current.some(n => n.selected),
            handler: (e) => {
                e.preventDefault();
                const flowSelectedNode = nodesRef.current.find(n => n.selected);
                if (flowSelectedNode && onEditNode) {
                    onEditNode(e as any, flowSelectedNode);
                }
            }
        }
    ], { scopeName: 'Workflow Editor', enabled: !!activeWorkflow });

    return (
        <AppFormView
            title={activeWorkflow?.name || 'Workflow'}
            parentTitle="Workflows"
            icon="automation"
            isDirty={isDirty}
            onSave={saveWorkflow}
            onCancel={onBack}
            isSaving={isSaving}
            saveLabel="Save Workflow"
            allowedShortcuts={['cmd+c', 'ctrl+c', 'cmd+v', 'ctrl+v', 'f5', 'f2']}
            fullHeight
            noPadding
            entityId={isAdmin ? activeWorkflow?.id : undefined}
            entityType={isAdmin ? "workflows" : undefined}
            isLocked={activeWorkflow?.is_locked}
            onLockToggle={(locked: boolean) => {
                setActiveWorkflow({ ...activeWorkflow, is_locked: locked });
            }}
            headerRightContent={
                <div className="flex items-center gap-2">
                    <WorkflowActions
                        isRunning={isRunning}
                        onRun={() => runWorkflow(() => setIsConsoleVisible(true), activeClientId)}
                        onOpenParameters={onOpenParameters}
                        isDisabled={isSaving}
                    />
                </div>
            }
        >
            <div className="flex-1 flex flex-col min-h-0 relative">
                <style>{`
                    .workflow-editor-container .react-flow__pane { cursor: crosshair; }
                `}</style>
                <div className="flex-1 flex flex-col min-h-0 relative">
                    <div className="flex-1 flex min-h-0 relative">
                        <div className="flex-1 flex flex-col relative workflow-editor-container">
                            {activeWorkflow && (
                                <WorkflowGraph
                                    workflow={activeWorkflow}
                                    nodeTypes={nodeTypes}
                                    isReadOnly={activeWorkflow.is_locked}
                                    onNodesChangeCallback={onNodesChange}
                                    onEdgesChangeCallback={onEdgesChange}
                                    onNodeDoubleClickCallback={onEditNode}
                                    onNodeSelectCallback={handleNodeSelect}
                                    activeNodeIds={activeNodeIds}
                                />
                            )}
                        </div>

                        <AppParametersView
                            title={selectedNode ? "Node Properties" : "Workflow Parameters"}
                            isExpanded={isParamsExpanded}
                            onToggle={handleToggleParams}
                            placeholder="No parameters"
                        >
                            {selectedNode ? (
                                <NodeEditorView
                                    key={selectedNode.id}
                                    inline
                                    node={selectedNode}
                                    nodeTypes={nodeTypes}
                                    onChange={handleParamsChange}
                                    workflowParameters={activeWorkflow?.parameters || []}
                                    isLocked={activeWorkflow.is_locked}
                                    onBack={() => {
                                        setSelectedNode(null);
                                        setIsParamsExpanded(false);
                                    }}
                                />
                            ) : (
                                <div className="space-y-4">
                                    {activeWorkflow?.parameters?.map((param: any, pIdx: number) => (
                                        <div key={param.id} className="space-y-1.5">
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{param.parameter_name}</label>
                                            <AppParameterSelectByTamplate
                                                parameter={param}
                                                value={param.default_value || ''}
                                                onChange={(val) => {
                                                    const newParams = [...activeWorkflow.parameters];
                                                    newParams[pIdx] = { ...newParams[pIdx], default_value: val };
                                                    setActiveWorkflow({ ...activeWorkflow, parameters: newParams });
                                                    notifyChange();
                                                }}
                                                options={paramOptions[param.parameter_name] || []}
                                            />
                                        </div>
                                    ))}
                                    {(!activeWorkflow?.parameters || activeWorkflow.parameters.length === 0) && (
                                        <div className="flex flex-col items-center justify-center py-8 opacity-30">
                                            <Icon name="tune" size={32} className="mb-2" />
                                            <p className="text-[10px] font-medium">No parameters defined</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </AppParametersView>
                    </div>

                    {isParametersModalOpen && activeWorkflow && (
                        <AppCompactModalForm
                            isOpen={isParametersModalOpen}
                            title="Workflow Parameters"
                            onClose={() => setIsParametersModalOpen(false)}
                            onSubmit={() => {
                                setActiveWorkflow({ ...activeWorkflow, parameters: modalParams });
                                notifyChange();
                                setIsParametersModalOpen(false);
                            }}
                            width="max-w-4xl"
                        >
                            <AppParameterListEditor
                                parameters={modalParams}
                                onChange={setModalParams}
                                options={paramOptions}
                            />
                        </AppCompactModalForm>
                    )}

                    <AppConsole
                        tabs={[
                            { id: 'logs', label: 'Debug Console' },
                            { id: 'runtime', label: 'Runtime Data' }
                        ]}
                        activeTab={activeConsoleTab}
                        onTabChange={(id: any) => setActiveConsoleTab(id as any)}
                        isVisible={isConsoleVisible}
                        onClose={() => setIsConsoleVisible(false)}
                        resizable
                        height={consoleHeight}
                        onHeightChange={setConsoleHeight}
                        headerActions={
                            <div className="flex items-center gap-2">
                                {activeConsoleTab === 'logs' && (
                                    <button
                                        onClick={() => setShowSystemLogs(!showSystemLogs)}
                                        title={showSystemLogs ? "Hide system messages" : "Show system messages"}
                                        className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest leading-none px-2 py-1.5 rounded-lg transition-colors ${showSystemLogs
                                            ? 'bg-[var(--bg-app)] text-[var(--text-main)] border border-[var(--border-base)]'
                                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--border-base)]'
                                            }`}
                                    >
                                        <Icon name={showSystemLogs ? "visibility" : "visibility_off"} size={14} />
                                        <span>Sys Logs</span>
                                    </button>
                                )}
                            </div>
                        }
                    >
                        <div className="flex-1 overflow-auto p-4 custom-scrollbar min-h-0 h-full">
                            {activeConsoleTab === 'logs' ? (
                                <div className="space-y-1">
                                    {executionLogs
                                        .filter(log => showSystemLogs || log.level !== 'system')
                                        .map((log, i) => (
                                            <AppConsoleLogLine key={i} log={log as ConsoleLog} />
                                        ))}
                                    {executionLogs.length === 0 && (
                                        <div className="text-[var(--text-muted)] italic text-sm py-4">
                                            {'>'} Waiting for workflow execution logs...
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="h-full">
                                    {!liveRuntimeData || Object.keys(liveRuntimeData).length === 0 ? (
                                        <div className="text-[var(--text-muted)] italic text-sm py-4">
                                            {'>'} Runtime data is empty. Run the workflow to see live data here.
                                        </div>
                                    ) : (
                                        <pre className="text-[var(--text-main)] text-xs leading-relaxed whitespace-pre-wrap break-all font-mono">
                                            {JSON.stringify(liveRuntimeData, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            )}
                        </div>
                    </AppConsole>
                </div>
            </div>
        </AppFormView>
    );
};

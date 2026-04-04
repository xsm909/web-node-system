import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { AppJsonView, type AppJsonViewRef } from '../../../shared/ui/app-json-view/AppJsonView';
import { AppRoundButton } from '../../../shared/ui/app-round-button/AppRoundButton';
import { useWorkflowEditor } from './WorkflowEditorProvider';
import { marked } from 'marked';
import { useHotkeys } from '../../../shared/lib/hotkeys/useHotkeys';
import { HOTKEY_LEVEL } from '../../../shared/lib/hotkeys/HotkeysContext';
import { apiClient } from '../../../shared/api/client';
import { ParameterPresetSelector } from '../../../features/parameter-presets';
import { PresetSaveModal } from '../../../features/preset-management';
import { usePresets } from '../../../entities/preset';
import type { ObjectParameter } from '../../../entities/report/model/types';

interface WorkflowEditorViewProps {
    onBack: () => void;
    isInitialScene?: boolean;
}

export const WorkflowEditorView: React.FC<WorkflowEditorViewProps> = ({ onBack, isInitialScene }) => {
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
        activeClientId,
        activeProjectId,
        setIsConsoleVisible,
        isConsoleVisible,
        isHotkeysEnabled,
        saveSelectionAsPreset,
        onApplyPreset
    } = useWorkflowEditor();

    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isParamsExpanded, setIsParamsExpanded] = useState(false);
    const [isParametersModalOpen, setIsParametersModalOpen] = useState(false);
    const [modalParams, setModalParams] = useState<any[]>([]);
    const [paramOptions, setParamOptions] = useState<Record<string, any[]>>({});

    // Console state
    const [activeConsoleTab, setActiveConsoleTab] = useState<'logs' | 'runtime'>('logs');
    const [showSystemLogs, setShowSystemLogs] = useState(false);
    const [consoleHeight, setConsoleHeight] = useState(280);

    // JSON Preview state
    const [jsonPreviewModal, setJsonPreviewModal] = useState<{
        isOpen: boolean;
        data: any;
        title: string;
        url?: string;
        filename?: string;
        previewType?: string;
    }>({
        isOpen: false,
        data: null,
        title: 'Preview',
        previewType: 'json_preview'
    });
    const shownPreviewsRef = useRef<Set<string>>(new Set());
    const [savingParam, setSavingParam] = useState<ObjectParameter | null>(null);
    const { savePreset, isLoading: isSavingParamPreset } = usePresets('parameter');
    const jsonPreviewRef = useRef<AppJsonViewRef>(null);

    const handleToggleParams = useCallback(() => {
        setIsParamsExpanded(!isParamsExpanded);
    }, [isParamsExpanded]);

    const onOpenParameters = useCallback(() => {
        setModalParams(activeWorkflow?.parameters || []);
        setIsParametersModalOpen(true);
    }, [activeWorkflow?.parameters]);

    const handleParamsChange = useCallback((nodeId: string, params: any) => {
        const currentNodes = nodesRef.current || [];
        const nodeIndex = currentNodes.findIndex((n: any) => n.id === nodeId);
        if (nodeIndex === -1) return;

        // Check if params actually changed to avoid redundant updates
        const oldParams = currentNodes[nodeIndex].data?.params;
        if (JSON.stringify(oldParams) === JSON.stringify(params)) return;

        const updatedNodes = currentNodes.map((n: any) =>
            n.id === nodeId ? { ...n, data: { ...n.data, params } } : n
        );

        nodesRef.current = updatedNodes;

        setActiveWorkflow((prev: any) => {
            if (!prev) return prev;
            return { ...prev, graph: { ...prev.graph, nodes: updatedNodes } };
        });

        if (selectedNode?.id === nodeId) {
            setSelectedNode((prev: any) => {
                if (!prev) return prev;
                return { ...prev, data: { ...prev.data, params } };
            });
        }

        notifyChange?.();
    }, [setActiveWorkflow, notifyChange, selectedNode?.id, nodesRef]);

    const handleNodeSelect = useCallback((node: Node | null) => {
        const id = node?.id || null;
        setSelectedNodeId(id);

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
            if (paramOptions[param.parameter_name]) return;

            apiClient.post('/workflows/test-source', {
                source: param.source,
                value_field: param.value_field,
                label_field: param.label_field
            }).then(({ data }) => {
                if (data.options) {
                    setParamOptions(prev => ({ ...prev, [param.parameter_name]: data.options }));
                }
            }).catch(() => { });
        });
    }, [isParamsExpanded, isParametersModalOpen, activeWorkflow?.parameters, modalParams, paramOptions]);

    // Scan for previews in live runtime data
    useEffect(() => {
        if (!liveRuntimeData) return;

        const scanForPreviews = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;

            if ((obj.type === 'json_preview' || obj.type === 'text_preview' || obj.type === 'markdown_preview') && obj.url) {
                const url = obj.url;
                if (!shownPreviewsRef.current.has(url)) {
                    shownPreviewsRef.current.add(url);

                    // Fetch the file content
                    apiClient.get(url)
                        .then(res => {
                            setJsonPreviewModal({
                                isOpen: true,
                                data: res.data,
                                title: `Preview: ${obj.filename || 'Data'}`,
                                url: obj.url,
                                filename: obj.filename,
                                previewType: obj.type
                            });
                        })
                        .catch(err => console.error(`Failed to fetch ${obj.type}:`, err));
                }
            }

            if (obj.type === 'file_download' && obj.url) {
                const url = obj.url;
                if (!shownPreviewsRef.current.has(url)) {
                    shownPreviewsRef.current.add(url);

                    // Trigger programmatic download
                    const fullUrl = `${apiClient.defaults.baseURL?.replace(/\/$/, '') || ''}${url}`;
                    const link = document.createElement('a');
                    link.href = fullUrl;
                    link.download = obj.filename || 'download';
                    link.target = '_blank';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            }

            // Recurse into objects/arrays
            Object.values(obj).forEach(scanForPreviews);
        };

        scanForPreviews(liveRuntimeData);
    }, [liveRuntimeData]);

    const handleRunWorkflow = useCallback(() => {
        shownPreviewsRef.current.clear(); // Reset previews for new run
        runWorkflow(() => setIsConsoleVisible(true), activeClientId);
    }, [runWorkflow, setIsConsoleVisible, activeClientId]);

    const handleEditNodeAction = useCallback((e?: any) => {
        const targetId = selectedNodeId;
        if (!targetId || !onEditNode) return;

        const node = nodesRef.current.find(n => n.id === targetId);
        if (node) {
            onEditNode(e || {}, node);
        }
    }, [selectedNodeId, onEditNode, nodesRef]);

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
            enabled: !!selectedNodeId,
            handler: (e) => {
                e.preventDefault();
                handleEditNodeAction(e);
            }
        }
    ], {
        scopeName: 'Workflow Editor',
        enabled: (isHotkeysEnabled !== false) && !!activeWorkflow,
        level: HOTKEY_LEVEL.FRAGMENT
    });

    return (
        <AppFormView
            title={activeWorkflow?.name || 'Workflow'}
            parentTitle="Workflows"
            icon="workflow"
            isDirty={isDirty}
            onSave={saveWorkflow}
            onCancel={isInitialScene ? (() => { }) : onBack}
            isSaving={isSaving}
            saveLabel="Save Workflow"
            allowedShortcuts={['mod+c', 'mod+v', 'f5', 'f2', 'mod+s']}
            fullHeight
            noPadding
            entityId={activeWorkflow?.id}
            entityType="workflows"
            projectId={activeProjectId}
            isLocked={activeWorkflow?.is_locked}
            onLockToggle={(locked: boolean) => {
                setActiveWorkflow({ ...activeWorkflow, is_locked: locked });
            }}
            isHotkeysEnabled={isHotkeysEnabled}
            extraHeaderContent={
                <WorkflowActions
                    isRunning={isRunning}
                    onRun={handleRunWorkflow}
                    onOpenParameters={onOpenParameters}
                    onSavePreset={saveSelectionAsPreset}
                    onApplyPreset={onApplyPreset}
                    isDisabled={isSaving}
                    mode="extra"
                />
            }
            mainHeaderContent={
                <WorkflowActions
                    isRunning={isRunning}
                    onRun={handleRunWorkflow}
                    onOpenParameters={onOpenParameters}
                    onSavePreset={saveSelectionAsPreset}
                    onApplyPreset={onApplyPreset}
                    isDisabled={isSaving}
                    mode="main"
                />
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
                                    isReadOnly={activeWorkflow?.is_locked}
                                    onNodesChangeCallback={onNodesChange}
                                    onEdgesChangeCallback={onEdgesChange}
                                    onNodeDoubleClickCallback={onEditNode}
                                    onNodeSelectCallback={handleNodeSelect}
                                    activeNodeIds={activeNodeIds}
                                    isHotkeysEnabled={isHotkeysEnabled}
                                    onUpdateParams={handleParamsChange}
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
                                    isLocked={activeWorkflow?.is_locked}
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
                                                    setActiveWorkflow((prev: any) => {
                                                        if (!prev) return prev;
                                                        const newParams = [...prev.parameters];
                                                        newParams[pIdx] = { ...newParams[pIdx], default_value: val };
                                                        return { ...prev, parameters: newParams };
                                                    });
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
                                setActiveWorkflow({ ...activeWorkflow!, parameters: modalParams });
                                notifyChange();
                                setIsParametersModalOpen(false);
                            }}
                            width="max-w-4xl"
                        >
                            <AppParameterListEditor
                                parameters={modalParams}
                                onChange={setModalParams}
                                options={paramOptions}
                                isLocked={activeWorkflow?.is_locked}
                                renderHeaderActions={() => (
                                    <ParameterPresetSelector
                                        onLoad={(param) => setModalParams([...modalParams, param])}
                                    />
                                )}
                                renderParameterActions={(param: ObjectParameter) => (
                                    param.parameter_type === 'select' && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setSavingParam(param); }}
                                            className="p-1 hover:bg-[var(--border-base)] rounded-lg transition-colors text-[var(--text-muted)] hover:text-brand"
                                            title="Save as Preset"
                                        >
                                            <Icon name="bookmark_add" size={14} />
                                        </button>
                                    )
                                )}
                            />
                            <PresetSaveModal
                                isOpen={!!savingParam}
                                onClose={() => setSavingParam(null)}
                                entityType="parameter"
                                onSave={async (name, category) => {
                                    if (savingParam) {
                                        await savePreset(name, savingParam, category);
                                        setSavingParam(null);
                                    }
                                }}
                                isSaving={isSavingParamPreset}
                                title="Save Parameter Preset"
                                description={`Save settings for "${savingParam?.parameter_name}" as a reusable preset.`}
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
                                        <div className="h-full bg-[var(--bg-app)] rounded-xl border border-[var(--border-base)] overflow-hidden">
                                            <AppJsonView data={liveRuntimeData} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </AppConsole>
                </div>
            </div>

            {jsonPreviewModal.isOpen && (
                <AppCompactModalForm
                    isOpen={jsonPreviewModal.isOpen}
                    title={jsonPreviewModal.title}
                    onClose={() => setJsonPreviewModal(prev => ({ ...prev, isOpen: false }))}
                    onSubmit={() => setJsonPreviewModal(prev => ({ ...prev, isOpen: false }))}
                    submitLabel="Close"
                    width="max-w-5xl"
                    showCancel={false}
                    onDiscard={() => {
                        if (jsonPreviewModal.url) {
                            const fullUrl = `${apiClient.defaults.baseURL?.replace(/\/$/, '') || ''}${jsonPreviewModal.url}`;
                            const link = document.createElement('a');
                            link.href = fullUrl;
                            link.download = jsonPreviewModal.filename || 'download.json';
                            link.target = '_blank';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }
                    }}
                    discardLabel="Download"
                    headerRightContent={
                        jsonPreviewModal.previewType === 'json_preview' ? (
                            <div className="flex items-center gap-1">
                                <AppRoundButton icon="expand_all" variant="ghost" size="xs" onClick={() => jsonPreviewRef.current?.expandAll()} title="Expand All" />
                                <AppRoundButton icon="collapse_all" variant="ghost" size="xs" onClick={() => jsonPreviewRef.current?.collapseAll()} title="Collapse All" />
                                <AppRoundButton icon="content_copy" variant="ghost" size="xs" onClick={() => jsonPreviewRef.current?.copy()} title="Copy JSON" />
                                <AppRoundButton icon="schema" variant="ghost" size="xs" onClick={() => jsonPreviewRef.current?.showSchema()} title="Show Schema" />
                            </div>
                        ) : null
                    }
                >
                    <div className="h-[60vh] overflow-hidden rounded-xl border border-[var(--border-base)] bg-[var(--bg-app-alt)]">
                        {(!jsonPreviewModal.previewType || jsonPreviewModal.previewType === 'json_preview') ? (
                            <AppJsonView data={jsonPreviewModal.data} hideHeader={true} ref={jsonPreviewRef} />
                        ) : jsonPreviewModal.previewType === 'markdown_preview' ? (
                            <div className="p-4 h-full overflow-auto text-sm markdown-content bg-[var(--bg-app)]">
                                <div dangerouslySetInnerHTML={{ 
                                    __html: marked.parse(typeof jsonPreviewModal.data === 'string' 
                                        ? jsonPreviewModal.data 
                                        : JSON.stringify(jsonPreviewModal.data, null, 2)) as string 
                                }} />
                            </div>
                        ) : (
                            <div className="p-4 h-full overflow-auto text-xs font-mono text-[var(--text-main)] whitespace-pre-wrap select-text">
                                {typeof jsonPreviewModal.data === 'string' 
                                    ? jsonPreviewModal.data 
                                    : JSON.stringify(jsonPreviewModal.data, null, 2)}
                            </div>
                        )}
                    </div>
                </AppCompactModalForm>
            )}
        </AppFormView>
    );
};

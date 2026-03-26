import React from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';
import { AppRoundButton } from '../../../shared/ui/app-round-button/AppRoundButton';

interface WorkflowToolbarProps {
    nodeTypes: NodeType[];
}

export const WorkflowToolbar: React.FC<WorkflowToolbarProps> = ({ nodeTypes }) => {
    const toolbarNodes = nodeTypes.filter(nt => nt.show_in_toolbar);
    const [draggingNodeId, setDraggingNodeId] = React.useState<string | null>(null);

    const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
        // Delay hiding in toolbar to ensure it's captured in the drag snapshot
        setTimeout(() => setDraggingNodeId(nodeType.id), 0);
        event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeType));
        event.dataTransfer.effectAllowed = 'move';
    };

    const onDragEnd = () => {
        setDraggingNodeId(null);
    };

    return (
        <aside className="workflow-toolbar bg-surface-800/80 backdrop-blur-xl border border-[var(--border-base)] rounded-2xl p-2 shadow-2xl flex flex-col gap-2 ml-4 w-fit h-auto max-h-[calc(100%-40px)] pointer-events-auto overflow-visible">
            <style>{`
                .workflow-toolbar .icon {
                    fill: currentColor !important;
                }
                .workflow-toolbar .icon * {
                    fill: currentColor !important;
                    stroke: currentColor !important;
                }
            `}</style>

            {toolbarNodes.map((nt) => (
                <div
                    key={nt.id}
                    onDragStart={(event) => onDragStart(event, nt)}
                    onDragEnd={onDragEnd}
                    draggable
                    // NO vertical padding/margin here to prevent buttons from overlapping
                    // ONLY massive horizontal expansion for the drag ghost snapshot
                    className="relative group/item flex items-center justify-start h-8 pr-[240px] -mr-[240px] cursor-grab active:cursor-grabbing"
                >
                    <div className="flex items-center justify-center w-8 h-8 hover:scale-110 active:scale-95 transition-transform duration-200">
                        <AppRoundButton
                            icon={nt.icon || 'function'}
                            iconDir="node_icons"
                            variant="ghost"
                            size="small"
                            className="!bg-white !text-brand !shadow-none !cursor-inherit"
                        />
                    </div>

                    {/* Tooltip (Hint) positioned 12px to the right of the icon edge (icon is 40px wide here) */}
                    {draggingNodeId !== nt.id && (
                        <div
                            className="absolute left-[44px] top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-2xl border border-white/40 opacity-0 invisible group-hover/item:opacity-100 group-hover/item:visible transition-all duration-300 whitespace-nowrap z-[100] translate-x-[-10px] group-hover/item:translate-x-0 pointer-events-none"
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                backdropFilter: 'blur(16px)',
                                WebkitBackdropFilter: 'blur(10px)',
                                boxShadow: '0 1px 12px 0 rgba(0, 0, 0, 0.08)',
                            }}
                        >
                            <span className="text-[10px] font-black text-brand uppercase tracking-wider">
                                {nt.name}
                            </span>
                        </div>
                    )}
                </div>
            ))}

            {toolbarNodes.length === 0 && (
                <div className="text-[10px] text-[var(--text-muted)] text-center py-2 opacity-50 italic px-1">
                    No nodes
                </div>
            )}
        </aside>
    );
};

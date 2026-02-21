import React from 'react';
import type { NodeType } from '../../../entities/node-type/model/types';

interface NodeLibraryProps {
    nodeTypes: NodeType[];
    onAddNode: (node: NodeType) => void;
}

export const NodeLibrary: React.FC<NodeLibraryProps> = ({ nodeTypes, onAddNode }) => {
    return (
        <div className="space-y-6">
            <h3 className="px-1 text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Available Nodes</h3>
            <div className="grid grid-cols-1 gap-2">
                {nodeTypes.map((n) => (
                    <button
                        key={n.id}
                        className="group flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all text-left active:scale-[0.98]"
                        onClick={() => onAddNode(n)}
                        title={n.description}
                    >
                        <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                            📦
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-white/90 truncate group-hover:text-white transition-colors">{n.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-mono text-brand/60 uppercase tracking-tight">v{n.version}</span>
                                {n.category && (
                                    <>
                                        <span className="text-white/10">•</span>
                                        <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest truncate">{n.category}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};


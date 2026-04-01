import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { type NodeProps } from 'reactflow';
import { Icon } from '../../../shared/ui/icon';

export const GroupNode = memo(({ id, data, selected }: NodeProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [label, setLabel] = useState(data.label || 'Group');
    const inputRef = useRef<HTMLInputElement>(null);

    const onDoubleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
    }, []);

    const onBlur = useCallback(() => {
        setIsEditing(false);
        if (data.onRename) {
            data.onRename(id, label);
        }
    }, [id, label, data]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            // textarea select() works differently, but for standard use it's fine
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleUngroup = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (data.onUngroup) {
            data.onUngroup(id);
        }
    }, [id, data]);

    const [isHovered, setIsHovered] = useState(false);

    return (
        <div className="w-full h-full relative" style={{ transformStyle: 'preserve-3d' }}>
            {/* The actual 3D Background - Pushed BACK in 3D to stay behind edges layer */}
            <div className="group-background" />

            {/* Header / Title Container - Pulled FORWARD in 3D to stay on top of connections */}
            <div
                className="absolute top-0 left-0 right-0 flex items-center px-0 pointer-events-auto"
                style={{ 
                    transformStyle: 'preserve-3d', 
                    transform: 'translateZ(50px) translateY(-50%)',
                    zIndex: 100 
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* Left-aligned Label */}
                <div className="max-w-[calc(100%-48px)] flex justify-start pointer-events-auto">
                    <div className={`relative min-w-[60px] px-3 py-1.5 rounded-2xl text-xs font-light transition-all bg-surface-900 border text-brand ${isEditing ? 'border-brand/50 shadow-2xl' : selected ? 'border-brand/30 shadow-lg' : 'border-[var(--border-base)]'
                        }`}>
                        {/* Measurement / Hidden mirror for height & width auto-sizing */}
                        <div className="invisible whitespace-pre-wrap break-words min-h-[1.2em] font-light" aria-hidden="true">
                            {label || ' '}
                        </div>

                        {isEditing ? (
                            <textarea
                                ref={inputRef as any}
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                onBlur={onBlur}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        onBlur();
                                    }
                                    if (e.key === 'Escape') {
                                        setIsEditing(false);
                                        setLabel(data.label || 'Group');
                                    }
                                }}
                                className="absolute inset-0 w-full h-full bg-transparent outline-none px-3 py-1.5 rounded-2xl text-left font-light resize-none overflow-hidden"
                            />
                        ) : (
                            <div
                                onDoubleClick={onDoubleClick}
                                className="absolute inset-0 w-full h-full flex items-start py-1.5 px-3 cursor-text whitespace-pre-wrap break-words font-light"
                                title={label}
                            >
                                {label}
                            </div>
                        )}
                    </div>
                </div>

                {/* Simple X button at the right edge - Visible on selection OR hover */}
                {(selected || isHovered) && (
                    <button
                        onClick={handleUngroup}
                        className="absolute right-4 flex items-center justify-center w-6 h-6 rounded-full bg-surface-900 border border-[var(--border-base)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-400/50 transition-all shadow-xl pointer-events-auto opacity-100 animate-in fade-in zoom-in duration-200"
                        title="Ungroup nodes"
                    >
                        <Icon name="close" size={14} />
                    </button>
                )}
            </div>

            {/* Interaction Layer for the main block */}
            <div className="w-full h-full pointer-events-none" />
        </div>
    );
});

GroupNode.displayName = 'GroupNode';

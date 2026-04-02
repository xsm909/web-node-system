import React, { useState, useRef } from 'react';
import './AppJsonView.css';
import { Icon } from '../icon';
import { AppRoundButton } from '../app-round-button/AppRoundButton';
import { API_BASE_URL } from '../../api/client';
import { AppCompactModalForm } from '../app-compact-modal-form/AppCompactModalForm';

interface AppJsonViewProps {
    data: any;
    initialExpanded?: boolean;
}

interface JsonNodeProps {
    value: any;
    label?: string;
    isLast?: boolean;
    depth: number;
    forceExpanded?: boolean | null;
}

const inferSchema = (val: any): any => {
    if (val === null) return { type: 'null' };
    if (Array.isArray(val)) {
        return {
            type: 'array',
            items: val.length > 0 ? inferSchema(val[0]) : { type: 'any' }
        };
    }
    if (typeof val === 'object') {
        const properties: Record<string, any> = {};
        Object.entries(val).forEach(([k, v]) => {
            properties[k] = inferSchema(v);
        });
        return { type: 'object', properties };
    }
    return { type: typeof val };
};

const JsonNode: React.FC<JsonNodeProps> = ({ value, label, isLast, depth, forceExpanded }) => {
    const [isExpanded, setIsExpanded] = useState(depth < 2);
    
    // Support external expand/collapse state if provided
    React.useEffect(() => {
        if (typeof forceExpanded === 'boolean') {
            setIsExpanded(forceExpanded);
        }
    }, [forceExpanded]);

    const toggle = () => setIsExpanded(!isExpanded);

    const isObject = value !== null && typeof value === 'object';
    const isArray = Array.isArray(value);
    const isEmpty = isObject && (isArray ? value.length === 0 : Object.keys(value).length === 0);

    const renderValue = () => {
        if (value === null) return <span className="json-null">null</span>;
        if (typeof value === 'string') {
            // Check if it's a download link
            if (value.startsWith('/files/download/')) {
                const fullUrl = `${API_BASE_URL}${value}`;
                return (
                    <a 
                        href={fullUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="json-string json-link underline decoration-dotted hover:decoration-solid transition-all inline-flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                        title="Click to download file"
                    >
                        <Icon name="download" size={12} />
                        "{value}"
                    </a>
                );
            }
            return <span className="json-string">"{value}"</span>;
        }
        if (typeof value === 'number') return <span className="json-number">{value}</span>;
        if (typeof value === 'boolean') return <span className="json-boolean">{value.toString()}</span>;
        return null;
    };

    if (!isObject || isEmpty) {
        return (
            <div className="json-line" style={{ paddingLeft: `${depth * 20}px` }}>
                {label && <span className="json-key">{label}: </span>}
                {isEmpty ? (
                    <span className="json-punc">{isArray ? '[]' : '{}'}</span>
                ) : (
                    renderValue()
                )}
                {!isLast && <span className="json-punc">,</span>}
            </div>
        );
    }

    // Special handling for file_download / json_preview objects to show as buttons
    if (value && typeof value === 'object' && (value.type === 'file_download' || value.type === 'json_preview') && value.url) {
        const fullUrl = `${API_BASE_URL}${value.url}`;
        const isPreview = value.type === 'json_preview';
        
        return (
            <div className="json-line" style={{ paddingLeft: `${depth * 20}px` }}>
                {label && <span className="json-key">{label}: </span>}
                <div className="flex items-center gap-2 py-1">
                    <a 
                        href={fullUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                            isPreview 
                            ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20' 
                            : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Icon name={isPreview ? "visibility" : "download"} size={14} />
                        {isPreview ? "Preview JSON" : `Download ${value.filename || 'File'}`}
                    </a>
                </div>
                {!isLast && <span className="json-punc">,</span>}
            </div>
        );
    }

    const bracketOpen = isArray ? '[' : '{';
    const bracketClose = isArray ? ']' : '}';

    return (
        <div className="json-node">
            <div 
                className="json-line json-toggleable" 
                onClick={toggle}
                style={{ paddingLeft: `${depth * 20}px` }}
            >
                <div className={`json-icon transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    <Icon name="arrow_right" size={14} />
                </div>
                {label && <span className="json-key">{label}: </span>}
                <span className="json-punc">{bracketOpen}</span>
                {!isExpanded && (
                    <span className="json-dots" title="Expand">...</span>
                )}
                {!isExpanded && (
                    <span className="json-punc">{bracketClose}{!isLast && ','}</span>
                )}
            </div>
            
            {isExpanded && (
                <div className="json-children">
                    {isArray 
                        ? value.map((v: any, i: number) => (
                            <JsonNode 
                                key={i} 
                                value={v} 
                                isLast={i === value.length - 1} 
                                depth={depth + 1} 
                                forceExpanded={forceExpanded}
                            />
                        ))
                        : Object.entries(value).map(([k, v], i, arr) => (
                            <JsonNode 
                                key={k} 
                                label={k} 
                                value={v} 
                                isLast={i === arr.length - 1} 
                                depth={depth + 1} 
                                forceExpanded={forceExpanded}
                            />
                        ))
                    }
                </div>
            )}
            
            {isExpanded && (
                <div className="json-line" style={{ paddingLeft: `${depth * 20}px` }}>
                    <span className="json-punc">{bracketClose}{!isLast && ','}</span>
                </div>
            )}
        </div>
    );
};

export interface AppJsonViewRef {
    expandAll: () => void;
    collapseAll: () => void;
    reset: () => void;
    copy: () => void;
    showSchema: () => void;
}

export const AppJsonView = React.forwardRef<AppJsonViewRef, AppJsonViewProps & { hideHeader?: boolean }>(({ data, hideHeader = false }, ref) => {
    const [globalExpanded, setGlobalExpanded] = useState<boolean | null>(null);
    const [isSchemaOpen, setIsSchemaOpen] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const schemaViewRef = useRef<AppJsonViewRef>(null);

    const handleExpandAll = () => setGlobalExpanded(true);
    const handleCollapseAll = () => setGlobalExpanded(false);
    const handleReset = () => setGlobalExpanded(null);

    const handleCopy = async () => {
        const text = JSON.stringify(data, null, 2);
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
            } else {
                throw new Error("Clipboard API not available");
            }
        } catch (err) {
            // Fallback for non-secure contexts
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (fallbackErr) {
                console.error('Fallback copy failed', fallbackErr);
            }
            document.body.removeChild(textArea);
        }
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    React.useImperativeHandle(ref, () => ({
        expandAll: handleExpandAll,
        collapseAll: handleCollapseAll,
        reset: handleReset,
        copy: handleCopy,
        showSchema: () => setIsSchemaOpen(true)
    }));

    const schema = React.useMemo(() => inferSchema(data), [data]);

    return (
        <div className="app-json-view">
            {!hideHeader && (
                <div className="app-json-view-header">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1">
                            <AppRoundButton icon="expand_all" variant="ghost" size="xs" onClick={handleExpandAll} title="Expand All" />
                            <AppRoundButton icon="collapse_all" variant="ghost" size="xs" onClick={handleCollapseAll} title="Collapse All" />
                            {globalExpanded !== null && (
                                <AppRoundButton icon="refresh" variant="ghost" size="xs" onClick={handleReset} title="Reset" className="opacity-60" />
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <AppRoundButton 
                                icon={isCopied ? "check" : "content_copy"} 
                                variant="ghost" 
                                size="xs" 
                                onClick={handleCopy} 
                                title="Copy JSON" 
                                className={isCopied ? 'text-emerald-500' : ''}
                            />
                            <AppRoundButton icon="schema" variant="ghost" size="xs" onClick={() => setIsSchemaOpen(true)} title="Show Schema" />
                        </div>
                    </div>
                </div>
            )}
            <div className="app-json-view-content">
                <JsonNode value={data} isLast={true} depth={0} forceExpanded={globalExpanded} />
            </div>

            <AppCompactModalForm
                isOpen={isSchemaOpen}
                onClose={() => setIsSchemaOpen(false)}
                title="JSON Schema Preview"
                icon="schema"
                onSubmit={() => setIsSchemaOpen(false)}
                submitLabel="Close"
                width="max-w-4xl"
                showCancel={false}
                headerRightContent={
                    <div className="flex items-center gap-1">
                        <AppRoundButton icon="expand_all" variant="ghost" size="xs" onClick={() => schemaViewRef.current?.expandAll()} title="Expand All" />
                        <AppRoundButton icon="collapse_all" variant="ghost" size="xs" onClick={() => schemaViewRef.current?.collapseAll()} title="Collapse All" />
                        <AppRoundButton icon="content_copy" variant="ghost" size="xs" onClick={() => schemaViewRef.current?.copy()} title="Copy JSON" />
                    </div>
                }
            >
                <div className="bg-[var(--bg-app)] rounded-lg border border-[var(--border-base)] overflow-hidden h-[60vh] min-h-[400px] flex flex-col">
                    <AppJsonView data={schema} hideHeader={true} ref={schemaViewRef} />
                </div>
            </AppCompactModalForm>
        </div>
    );
});

AppJsonView.displayName = 'AppJsonView';

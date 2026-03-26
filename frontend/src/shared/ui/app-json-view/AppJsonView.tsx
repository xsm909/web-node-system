import React, { useState } from 'react';
import './AppJsonView.css';
import { Icon } from '../icon';
import { API_BASE_URL } from '../../api/client';

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

export const AppJsonView: React.FC<AppJsonViewProps> = ({ data }) => {
    const [globalExpanded, setGlobalExpanded] = useState<boolean | null>(null);

    const handleExpandAll = () => setGlobalExpanded(true);
    const handleCollapseAll = () => setGlobalExpanded(false);
    const handleReset = () => setGlobalExpanded(null);

    return (
        <div className="app-json-view">
            <div className="app-json-view-header">
                <div className="flex items-center gap-2">
                    <button onClick={handleExpandAll} className="json-action-btn">
                        <Icon name="expand_all" size={14} />
                        Expand All
                    </button>
                    <button onClick={handleCollapseAll} className="json-action-btn">
                        <Icon name="collapse_all" size={14} />
                        Collapse All
                    </button>
                    {globalExpanded !== null && (
                        <button onClick={handleReset} className="json-action-btn opacity-60">
                            Reset
                        </button>
                    )}
                </div>
            </div>
            <div className="app-json-view-content">
                <JsonNode value={data} isLast={true} depth={0} forceExpanded={globalExpanded} />
            </div>
        </div>
    );
};

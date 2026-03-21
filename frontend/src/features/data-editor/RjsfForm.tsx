import React from 'react';
import FormRaw from '@rjsf/core';
import validatorRaw from '@rjsf/validator-ajv8';
import type {
    BaseInputTemplateProps,
    FieldTemplateProps,
    ObjectFieldTemplateProps,
    ArrayFieldTemplateProps,
    WidgetProps,
    ErrorListProps,
} from '@rjsf/utils';
import { getInputProps } from '@rjsf/utils';
import { Icon } from '../../shared/ui/icon';
import { ComboBox } from '../../shared/ui/combo-box/ComboBox';
import { AppFormFieldRect } from '../../shared/ui/app-input/AppFormFieldRect';
import { apiClient } from '../../shared/api/client';

// ─── Interop Handles ───────────────────────────────────────────────────────────
const getInterop = (mod: any) => mod?.default || mod;
const Form = getInterop(FormRaw);
const validator = getInterop(validatorRaw);

// ─── Base Input ────────────────────────────────────────────────────────────────
function BaseInputTemplate(props: BaseInputTemplateProps) {
    const {
        id, value, type, placeholder, required, disabled, readonly,
        onChange, onBlur, onFocus, options, schema, rawErrors 
    } = props;
    const inputProps = getInputProps(schema, type, options);
    const hasError = rawErrors && rawErrors.length > 0;

    // Safety check for objects in primitive fields
    const displayValue = (typeof value === 'object' && value !== null)
        ? JSON.stringify(value)
        : (value ?? '');

    return (
        <AppFormFieldRect className={hasError ? 'border-red-500 ring-1 ring-red-500/20' : ''}>
            <input
                id={id}
                name={id}
                type={inputProps.type ?? 'text'}
                value={displayValue}
                placeholder={placeholder}
                required={required}
                disabled={disabled || readonly}
                step={inputProps.step}
                min={inputProps.min}
                max={inputProps.max}
                onChange={(e) => onChange(e.target.value === '' ? options.emptyValue : e.target.value)}
                onBlur={(e) => onBlur(id, e.target.value)}
                onFocus={(e) => onFocus(id, e.target.value)}
                className="w-full bg-transparent outline-none disabled:opacity-50 h-full text-xs font-normal"
            />
        </AppFormFieldRect>
    );
}

// ─── Textarea Widget ───────────────────────────────────────────────────────────
function TextareaWidget(props: WidgetProps) {
    const { id, value, placeholder, required, disabled, readonly, onChange, onBlur, onFocus, options, rawErrors } = props;
    const hasError = rawErrors && rawErrors.length > 0;

    // Safety check for objects in primitive fields
    const displayValue = (typeof value === 'object' && value !== null)
        ? JSON.stringify(value)
        : (value ?? '');

    return (
        <AppFormFieldRect className={`h-auto py-2 ${hasError ? 'border-red-500 ring-1 ring-red-500/20' : ''}`}>
            <textarea
                id={id}
                name={id}
                value={displayValue}
                placeholder={placeholder}
                required={required}
                disabled={disabled || readonly}
                rows={3}
                onChange={(e) => onChange(e.target.value === '' ? options.emptyValue : e.target.value)}
                onBlur={(e) => onBlur(id, e.target.value)}
                onFocus={(e) => onFocus(id, e.target.value)}
                className="w-full bg-transparent outline-none text-xs font-normal resize-none disabled:opacity-50"
            />
        </AppFormFieldRect>
    );
}

// ─── Reference Widget ────────────────────────────────────────────────────────
function ReferenceWidget(props: WidgetProps) {
    const { value, onChange, schema, formContext, registry, disabled, readonly, placeholder, rawErrors } = props;
    const recordId = formContext?.recordId || (registry as any)?.formContext?.recordId;

    const schemaKey = (schema as any)['x-schema-key'];
    const displayField = (schema as any)['x-display'] || 'id';
    const valueField = (schema as any)['x-reference-field'] || 'id';

    const [references, setReferences] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);

    const fetchReferences = React.useCallback(async () => {
        if (!recordId || !schemaKey) {
            return;
        }

        setIsLoading(true);
        try {
            const response = await apiClient.get(`/records/references/${recordId}`, {
                params: { schema_key: schemaKey }
            });
            setReferences(response.data || []);
        } catch (error: any) {
        } finally {
            setIsLoading(false);
        }
    }, [recordId, schemaKey]);

    const handleOpenChange = (open: boolean) => {
        if (open && references.length === 0) {
            fetchReferences();
        }
    };

    React.useEffect(() => {
        if (value && references.length === 0) {
            fetchReferences();
        }
    }, [value, fetchReferences, references.length]);

    const items = React.useMemo(() => {
        console.log("[ReferenceWidget] Processing references count:", references.length);

        return references.map((r: any) => {
            let label = String(r.id);
            const data = r.data || {};

            if (data && typeof data === 'object') {
                label = data[displayField] || data.name || data.title || data.key || data.description || String(r.id);
            }

            return {
                id: String(r[valueField] || r.id),
                name: String(label),
                description: r.schema?.key || r.schema_id,
                icon: 'link'
            };
        });
    }, [references, displayField, valueField]);

    const selectedItem = React.useMemo(() => {
        return items.find(i => i.id === String(value)) || null;
    }, [items, value]);

    const isLoadingState = isLoading;

    return (
        <div className="w-full">
            <ComboBox
                items={items}
                onSelect={(item: any) => onChange(item.id)}
                onOpenChange={handleOpenChange}
                value={value ? String(value) : undefined}
                label={selectedItem?.name}
                placeholder={isLoadingState ? "Loading..." : placeholder || "Select reference..."}
                searchPlaceholder="Search records..."
                icon="link"
                className={`w-full ${rawErrors && rawErrors.length > 0 ? 'border-red-500 ring-1 ring-red-500/20 rounded-lg' : ''}`}
                disabled={disabled || readonly}
            />
        </div>
    );
}

// ─── Select Widget ─────────────────────────────────────────────────────────────
function SelectWidget(props: WidgetProps) {
    const { id, value, options, required, disabled, readonly, onChange, rawErrors } = props;
    const { enumOptions } = options;
    const hasError = rawErrors && rawErrors.length > 0;

    return (
        <AppFormFieldRect className={hasError ? 'border-red-500 ring-1 ring-red-500/20' : ''}>
            <select
                id={id}
                name={id}
                value={value ?? ''}
                required={required}
                disabled={disabled || readonly}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-transparent outline-none disabled:opacity-50 h-full text-xs font-normal cursor-pointer"
            >
                {!required && <option value="">— Select —</option>}
                {(enumOptions as { value: unknown; label: string }[] | undefined)?.map((opt) => (
                    <option key={String(opt.value)} value={String(opt.value)}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </AppFormFieldRect>
    );
}

// ─── Error List Template ──────────────────────────────────────────────────────
function ErrorListTemplate(props: ErrorListProps) {
    const { errors } = props;
    return (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/5 border border-red-500/20 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 mb-3 text-red-500">
                <Icon name="warning" size={18} />
                <span className="text-xs font-bold uppercase tracking-wider">Validation Errors ({errors.length})</span>
            </div>
            <ul className="space-y-2">
                {errors.map((error, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-red-400/90 leading-relaxed font-medium">
                        <span className="mt-1 w-1 h-1 rounded-full bg-red-500/40 shrink-0" />
                        {error.stack}
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ─── Checkbox Widget ───────────────────────────────────────────────────────────
function CheckboxWidget(props: WidgetProps) {
    const { id, value, disabled, readonly, onChange, label } = props;
    return (
        <label htmlFor={id} className="flex items-center gap-3 cursor-pointer group">
            <div className="relative flex-shrink-0">
                <input
                    id={id}
                    name={id}
                    type="checkbox"
                    checked={!!value}
                    disabled={disabled || readonly}
                    onChange={(e) => onChange(e.target.checked)}
                    className="sr-only peer"
                />
                <div className="w-4 h-4 rounded border border-gray-600 bg-surface-950 peer-checked:bg-brand peer-checked:border-brand transition-all flex items-center justify-center">
                    {!!value && <Icon name="check" size={10} className="text-white" />}
                </div>
            </div>
            <span className="text-sm text-[var(--text-main)]">{label}</span>
        </label>
    );
}

// ─── Field Template ────────────────────────────────────────────────────────────
function FieldTemplate(props: FieldTemplateProps) {
    const { id, label, required, children, errors, description, hidden, displayLabel } = props;
    if (hidden) return <>{children}</>;

    // Safety check for errors/description to prevent [object Object] rendering
    const renderedErrors = React.isValidElement(errors) 
        ? errors 
        : (Array.isArray(errors) ? (errors as any[]).join(', ') : (typeof errors === 'string' ? errors : null));
    const renderedDescription = React.isValidElement(description) ? description : (typeof description === 'string' ? description : null);

    return (
        <div className="flex flex-col gap-1 mb-2.5">
            {displayLabel && label && (
                <label htmlFor={id} className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                    {label}
                    {required && <span className="text-brand ml-1">*</span>}
                </label>
            )}
            {renderedDescription && (
                <div className="text-[11px] text-[var(--text-muted)] -mt-1">{renderedDescription}</div>
            )}
            {children}
            {renderedErrors && (
                <div className="text-[10px] text-red-500 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                    <Icon name="warning" size={10} />
                    {renderedErrors}
                </div>
            )}
        </div>
    );
}

// ─── Object Field Template ─────────────────────────────────────────────────────
function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
    const { title, description, properties, schema } = props;

    const renderedDescription = React.isValidElement(description) ? description : (typeof description === 'string' ? description : null);

    return (
        <div className="space-y-2">
            {title && (
                <div className="pb-2 border-b border-[var(--border-base)]/50">
                    <h3 className="text-sm font-bold text-[var(--text-main)]">{title}</h3>
                    {renderedDescription && (
                        <div className="text-xs text-[var(--text-muted)] mt-0.5">{renderedDescription}</div>
                    )}
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0">
                {properties.map((prop) => {
                    const propSchema = (schema.properties as any)?.[prop.name] || {};
                    const isFullWidth = propSchema.type === 'object' || propSchema.type === 'array';

                    return (
                        <div key={prop.name} className={isFullWidth ? 'sm:col-span-2' : ''}>
                            {prop.content}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Array Field Item Template ────────────────────────────────────────────────
/**
 * RJSF handlers (especially in different themes/versions) can be either:
 * 1. Direct calls: handler(index) or handler(event)
 * 2. Factory calls: handler(index)(event)
 * This helper ensures we execute whichever one is provided correctly.
 */
function safeInvoke(event: React.BaseSyntheticEvent | undefined, handler: any, ...args: any[]) {
    if (typeof handler !== 'function') return;
    try {
        // If it's a factory, it returns a function
        const result = handler(...args);
        if (typeof result === 'function') {
            result(event);
        }
        // If it returns nothing (undefined), it might have already executed 
        // OR it's a direct handler that expects (event, ...args).
        // Since we can't be sure without risking double-execution, 
        // we handle the known Direct handlers explicitly in the template.
    } catch (e) {
        console.error("[RjsfForm] Action failed:", e);
    }
}

function ArrayFieldItemTemplate(props: any) {
    const {
        children, index, onDropIndexClick, onReorderClick,
        disabled, readonly, hasRemove, hasMoveUp, hasMoveDown,
        buttonsProps, totalItems
    } = props;

    // Factories (Standard RJSF)
    const dropFactory = onDropIndexClick || buttonsProps?.onDropIndexClick;
    const reorderFactory = onReorderClick || buttonsProps?.onReorderClick;

    // Direct Handlers (Theme-specific in buttonsProps)
    const dropDirect = buttonsProps?.onRemoveItem;
    const upDirect = buttonsProps?.onMoveUpItem;
    const downDirect = buttonsProps?.onMoveDownItem;

    // Visibility flags
    const hasRem = hasRemove || buttonsProps?.hasRemove || (!!dropFactory) || (!!dropDirect);
    const canUp = hasMoveUp || buttonsProps?.hasMoveUp || (index > 0);
    const canDown = hasMoveDown || buttonsProps?.hasMoveDown || (index < (totalItems ?? props.totalItems ?? 0) - 1);

    const handleAction = (e: React.MouseEvent, type: 'up' | 'down' | 'drop') => {
        e.preventDefault();
        e.stopPropagation();

        if (type === 'drop') {
            if (dropFactory) safeInvoke(e, dropFactory, index);
            else if (dropDirect) dropDirect(e);
        } else if (type === 'up') {
            if (reorderFactory) safeInvoke(e, reorderFactory, index, index - 1);
            else if (upDirect) upDirect(e);
        } else if (type === 'down') {
            if (reorderFactory) safeInvoke(e, reorderFactory, index, index + 1);
            else if (downDirect) downDirect(e);
        }
    };

    return (
        <div className="group relative mb-4">
            <div className="p-4 rounded-2xl bg-surface-950/20 border border-gray-800/50 transition-all group-hover:border-brand/40 group-hover:bg-surface-950/40 shadow-sm relative">
                {children}

                {/* "Chelka" (hover tab) at the bottom right */}
                {!(disabled || readonly) && (
                    <div className="absolute bottom-0 right-6 translate-y-1/2 hidden group-hover:flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-app)] border-2 border-brand/50 rounded-2xl shadow-2xl z-[100] pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
                        {canUp && (
                            <button
                                type="button"
                                onClick={(e) => handleAction(e, 'up')}
                                className="p-1 rounded-lg text-[var(--test-muted)] hover:text-brand hover:bg-brand/10 transition-colors"
                            >
                                <Icon name="up" size={16} />
                            </button>
                        )}
                        {canDown && (
                            <button
                                type="button"
                                onClick={(e) => handleAction(e, 'down')}
                                className="p-1 rounded-lg text-[var(--test-muted)] hover:text-brand hover:bg-brand/10 transition-colors"
                            >
                                <Icon name="down" size={16} />
                            </button>
                        )}
                        {(canUp || canDown) && hasRem && (
                            <div className="w-px h-4 bg-[var(--border-base)] mx-1" />
                        )}
                        {hasRem && (
                            <button
                                type="button"
                                onClick={(e) => handleAction(e, 'drop')}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                                <Icon name="delete" size={16} />
                                <span className="text-xs font-normal truncate w-full">Delete</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Array Field Template ──────────────────────────────────────────────────────
function ArrayFieldTemplate(props: ArrayFieldTemplateProps) {
    const { title, items, canAdd, onAddClick, disabled, readonly } = props;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
                {title && (
                    <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {title}
                    </span>
                )}
                {canAdd && !disabled && !readonly && (
                    <button
                        type="button"
                        onClick={onAddClick}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-brand border border-brand/30 rounded-lg hover:bg-brand/10 transition-colors ml-auto"
                    >
                        <Icon name="add" size={14} />
                        Add Item
                    </button>
                )}
            </div>
            <div className="space-y-2">
                {items.map((item: any, idx: number) => (
                    <div key={item.key || idx}>
                        {item.children || item.content || item.element || (React.isValidElement(item) ? item : null)}
                    </div>
                ))}
            </div>
            {items.length === 0 && (
                <div className="text-xs text-[var(--text-muted)] italic px-1 py-4 text-center border-2 border-dashed border-[var(--border-base)]/30 rounded-2xl">
                    No items yet
                </div>
            )}
        </div>
    );
}


// ─── Deep Ref Inliner ──────────────────────────────────────────────────────────
function inlineRefs(
    node: any,
    defs: Record<string, any>,
    visited = new Set<string>(),
): any {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map((n) => inlineRefs(n, defs, visited));

    // AJV 8 often errors out on $schema draft URLs it doesn't recognize.
    const { $schema: _s, $id: _i, ...cleanNode } = node;

    if ('$ref' in cleanNode && typeof cleanNode.$ref === 'string') {
        const ref = cleanNode.$ref;
        if (visited.has(ref)) return { type: 'object', title: `Circular reference (${ref})` };
        
        const next = new Set(visited);
        next.add(ref);

        let key = ref;
        if (ref.startsWith('#/$defs/')) key = ref.slice(8);
        else if (ref.startsWith('#/definitions/')) key = ref.slice(14);
        else if (ref.startsWith('#')) {
            const parts = ref.split('/');
            key = parts[parts.length - 1];
        }

        if (key && defs[key]) {
            const { $ref: _r, ...siblings } = cleanNode;
            const defBody = defs[key];
            return inlineRefs({ ...defBody, ...siblings }, defs, next);
        } else if (key && !defs[key]) {
            console.warn(`RjsfForm: Could not find a definition for ${ref}.`);
            return { type: 'string', title: `Error: Reference not found (${ref})`, readOnly: true };
        }
    }

    const result: any = {};
    for (const k of Object.keys(cleanNode)) {
        if (k === '$defs' || k === 'definitions') continue;
        result[k] = inlineRefs(cleanNode[k], defs, visited);
    }
    return result;
}

/**
 * Traverses the schema and collects ui:widget for properties that have x-reference: "record".
 */
function extractUiSchema(schema: any): any {
    if (!schema || typeof schema !== 'object') return {};

    let uiSchema: any = {};

    if (schema['x-reference'] === 'record') {
        uiSchema['ui:widget'] = 'ReferenceWidget';
    }

    if (schema.type === 'object' && schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
            const res = extractUiSchema(prop);
            if (Object.keys(res).length > 0) uiSchema[key] = res;
        }
    } else if (schema.type === 'array') {
        uiSchema['ui:options'] = { removable: true, addable: true, orderable: true };
        uiSchema['ui:removable'] = true;
        uiSchema['ui:addable'] = true;
        uiSchema['ui:orderable'] = true;

        if (schema.items) {
            const res = extractUiSchema(schema.items);
            if (Object.keys(res).length > 0) uiSchema.items = res;
        }
    }
    return uiSchema;
}

// ─── Main RjsfForm Component ───────────────────────────────────────────────────
interface RjsfFormProps {
    schema: Record<string, unknown>;
    uiSchema?: Record<string, unknown>;
    formData: unknown;
    onChange: (data: unknown, isValid: boolean, errors?: any[]) => void;
    readOnly?: boolean;
    /** Map of schemaKey → parsed schema content for resolving $ref */
    extraSchemas?: Record<string, any>;
    activeClientId?: string;
    assignments?: any[];
    recordId?: string;
    onSubmit?: (data: any) => void;
}

export const RjsfForm = React.forwardRef<any, RjsfFormProps>((props, ref) => {
    const {
        schema,
        uiSchema,
        formData,
        onChange,
        readOnly = false,
        extraSchemas = {},
        activeClientId,
        assignments = [],
        recordId,
    } = props;

    const formRef = React.useRef<any>(null);

    React.useImperativeHandle(ref, () => ({
        submit: () => {
            if (formRef.current) {
                formRef.current.submit();
            }
        }
    }));

    if (typeof Form !== 'function' && typeof Form !== 'object') {
        return <div className="p-4 text-red-400">Error: Form component is not valid.</div>;
    }

    const safeSchema = React.useMemo(() => {
        const base = schema && typeof schema === 'object' ? schema : { type: 'object' };
        const rootDefs = (base.$defs as any) || (base as any).definitions || {};
        const allDefs: Record<string, any> = { ...rootDefs, ...extraSchemas };
        const result = inlineRefs(base, allDefs);
        console.log("[RjsfForm] safeSchema resolved:", result);
        return result;
    }, [JSON.stringify(schema), JSON.stringify(extraSchemas)]);

    const extraUiSchema = React.useMemo(() => {
        const ui = extractUiSchema(safeSchema);
        console.log("[RjsfForm] extraUiSchema extracted:", ui);
        return ui;
    }, [safeSchema]);

    const resolvedUiSchema = React.useMemo(() => {
        const base: any = {
            'ui:submitButtonOptions': { norender: true },
            ...(readOnly ? { 'ui:readonly': true } : {}),
        };

        // Deep-ish merge extraUiSchema and user-provided uiSchema
        const extra = extraUiSchema || {};
        const user = uiSchema || {};
        const merged = { ...extra };

        for (const key of Object.keys(user)) {
            if (typeof user[key] === 'object' && user[key] !== null && typeof extra[key] === 'object' && extra[key] !== null) {
                merged[key] = { ...extra[key], ...user[key] };
            } else {
                merged[key] = user[key];
            }
        }

        return { ...base, ...merged };
    }, [readOnly, extraUiSchema, uiSchema]);

    return (
        <Form
            ref={formRef}
            schema={safeSchema as any}
            uiSchema={resolvedUiSchema}
            formData={formData}
            validator={validator}
            templates={{
                BaseInputTemplate,
                FieldTemplate,
                ObjectFieldTemplate,
                ArrayFieldTemplate,
                ArrayFieldItemTemplate,
                ErrorListTemplate,
            }}
            widgets={{
                TextareaWidget,
                SelectWidget,
                ReferenceWidget,
                CheckboxWidget,
            }}
            formContext={{
                activeClientId,
                assignments,
                recordId
            }}
            onChange={(e: any) => {
                const errors = e.errors ?? [];
                console.log("[RjsfForm] onChange - valid:", errors.length === 0, "errors:", errors);
                onChange(e.formData, errors.length === 0, errors);
            }}
            onSubmit={(e: any) => {
                console.log("[RjsfForm] onSubmit - final data:", e.formData);
                props.onSubmit?.(e.formData);
            }}
            liveValidate={true}
            showErrorList={true}
        />
    );
});

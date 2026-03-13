export type ReportType = 'global' | 'client';

export interface ReportParameter {
    id: string;
    parameter_name: string;
    source: string;
    value_field: string;
    label_field: string;
}

export interface ReportStyle {
    id: string;
    name: string;
    css: string;
    is_default: boolean;
}

export interface Report {
    id: string;
    name: string;
    type: ReportType;
    description: string;
    query: string;
    template: string;
    style_id?: string;
    category?: string;
    created_by: string;
    parameters: ReportParameter[];
    meta?: Record<string, any>;
}

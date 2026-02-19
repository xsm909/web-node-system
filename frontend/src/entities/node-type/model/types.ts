export interface NodeType {
    id: string;
    name: string;
    version: string;
    description: string;
    code: string;
    input_schema: any;
    output_schema: any;
    parameters?: any[];
    category?: string;
    is_async: boolean;
}

export interface Workflow {
    id: string;
    name: string;
    status: string;
    owner_id: string;
    workflow_data_schema?: any;
    workflow_data?: any;
    runtime_data_schema?: any;
    runtime_data?: any;
    graph?: any;
}

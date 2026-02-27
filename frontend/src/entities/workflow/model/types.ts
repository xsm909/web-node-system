export interface Workflow {
    id: string;
    name: string;
    status: string;
    owner_id: string;
    workflow_data?: any;
    graph?: any;
}

import http from './http';
import type { PageResult, Workflow, WorkflowRun, WorkflowStep } from '@/types';

export type WorkflowStepInput = Pick<WorkflowStep, 'id' | 'promptId' | 'model' | 'bindings'>;
export interface WorkflowInput {
  name: string;
  description: string;
  steps: WorkflowStepInput[];
}

export function getWorkflows(): Promise<Workflow[]> {
  return http.get('/workflows');
}

export function getWorkflow(id: string): Promise<Workflow> {
  return http.get(`/workflows/${id}`);
}

export function createWorkflow(input: WorkflowInput): Promise<Workflow> {
  return http.post('/workflows', input);
}

export function updateWorkflow(id: string, input: WorkflowInput): Promise<Workflow> {
  return http.put(`/workflows/${id}`, input);
}

export function deleteWorkflow(id: string): Promise<null> {
  return http.delete(`/workflows/${id}`);
}

export function getWorkflowRuns(id: string): Promise<PageResult<WorkflowRun>> {
  return http.get(`/workflows/${id}/runs`, { params: { page: 1, pageSize: 20 } });
}

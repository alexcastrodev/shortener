import type { User } from '../../types/User';

export interface AuditLog {
  id: number;
  action: string;
  auditable_type: string;
  auditable_id: number;
  audited_changes: Record<string, unknown>;
  version: number;
  remote_address: string | null;
  request_uuid: string | null;
  created_at: string;
  user: User | null;
}

export interface AdminGetAuditsParams {
  user_id?: string;
}

export interface AdminGetAuditsResponse {
  audit: AuditLog[];
  meta: { total: number };
}

export type Role = 'user' | 'super_admin';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface User {
  id: number;
  full_name: string;
  login: string;
  role: Role;
  role_id: number | null;
  role_name: string | null;
  permissions: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppRole {
  id: number;
  name: string;
  permissions: string[];
  is_system: boolean;
  users_count?: number;
}

export interface PermissionGroup {
  group: string;
  items: { key: string; label: string }[];
}

export interface Person {
  id: number;
  full_name: string;
}

export interface AppealListItem {
  id: number;
  incoming_number: string;
  appeal_date: string;
  sender: string;
  sender_type: string;
  object_address: string;
  reply_deadline: string | null;
  category: string;
  status: string;
  assignee_id: number | null;
  assignee: Person | null;
}

export interface AppealFile {
  id: number;
  appeal_id: number;
  kind: string;
  original_name: string;
  mime: string;
  size: number;
  created_at: string;
  uploaded_by: Person;
}

export interface AppealEvent {
  id: number;
  action: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  user: Person;
}

export interface Appeal extends AppealListItem {
  correspondent_number: string;
  correspondent_date: string | null;
  reply_email: string;
  outgoing_number: string;
  outgoing_date: string | null;
  recognized_text: string;
  summary: string;
  draft_reply: string;
  final_reply: string;
  reply_checked_text: string;
  reply_checked_at: string | null;
  reply_checked_by: Person | null;
  created_by: Person;
  created_at: string;
  updated_at: string;
  files: AppealFile[];
  events: AppealEvent[];
}

export interface MailDraft {
  uid: number;
  uid_validity: string;
  from: string;
  email: string;
  subject: string;
  date: string | null;
  text: string;
}

export interface Lookups {
  statuses: string[];
  sender_types: string[];
  categories: { id: number; name: string }[];
  users: Person[];
}

export interface Material {
  id: number;
  kind: 'norm' | 'phrase' | 'example';
  title: string;
  citation: string;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardAppeal {
  id: number;
  incoming_number: string;
  appeal_date: string;
  sender: string;
  sender_type: string;
  category: string;
  status: string;
  reply_deadline: string | null;
  assignee: string;
  overdue: boolean;
}

export interface DashboardData {
  total: number;
  unassigned: number;
  overdue: number;
  by_status: { status: string; count: number }[];
  by_sender_type: { name: string; count: number }[];
  by_category: { name: string; count: number }[];
  fresh: DashboardAppeal[];
  deadlines: DashboardAppeal[];
}

export interface CategoryRow {
  id: number;
  name: string;
  is_active: boolean;
  appeals_count: number;
  created_at: string;
}

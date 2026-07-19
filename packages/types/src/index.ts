// Tipos de dominio compartidos entre @backuphub/web y @backuphub/api.
// Se mantienen independientes del cliente de Prisma para que el
// frontend nunca dependa del ORM del backend.

export type UserRole = "ADMIN" | "MEMBER" | "VIEWER";

export type AgentStatus = "ONLINE" | "OFFLINE" | "UNKNOWN";

export type AgentOs = "WINDOWS" | "LINUX" | "MACOS";

export type DestinationType = "USB" | "NAS" | "LOCAL_DISK" | "FOLDER" | "SERVER";

export type ExecutionStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface Agent {
  id: string;
  name: string;
  os: AgentOs;
  version: string;
  status: AgentStatus;
  lastSeenAt: string | null;
  capacityBytes: number | null;
  freeBytes: number | null;
  apiUrl: string;
}

export interface Source {
  id: string;
  path: string;
  agentId: string;
}

export interface Destination {
  id: string;
  type: DestinationType;
  path: string;
}

export interface BackupPlan {
  id: string;
  name: string;
  description: string | null;
  schedule: string | null;
  versioningMax: number;
  compression: boolean;
  encryption: boolean;
  excludeFilters: string[];
  tags: string[];
  status: string;
  agentId: string;
  agent?: Agent;
  sources: Source[];
  destinations: Destination[];
  createdAt: string;
  updatedAt: string;
}

export interface Execution {
  id: string;
  status: ExecutionStatus;
  startedAt: string | null;
  finishedAt: string | null;
  filesTotal: number | null;
  bytesTotal: number | null;
  errorMessage: string | null;
  backupPlanId: string;
}

export interface FileEntry {
  id: string;
  path: string;
  sizeBytes: number;
  sha256: string;
  modifiedAt: string;
  backedUpAt: string;
  status: string;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  message: string;
  resolved: boolean;
  createdAt: string;
}

export interface DashboardSummary {
  agentsOnline: number;
  agentsTotal: number;
  activeBackups: number;
  lastExecutionAt: string | null;
  usedBytes: number;
  freeBytes: number;
  failedExecutions24h: number;
  upcomingExecutions: Execution[];
  recentAlerts: Alert[];
}

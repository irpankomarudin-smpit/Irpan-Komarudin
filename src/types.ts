export type AttendanceStatus = 'present';
export type ScanMethod = 'camera' | 'manual' | 'image';
export type SessionMode = 'auto' | 'manual';

export interface InstitutionSettings {
  institutionName: string;
  examTitle: string;
  academicYear: string;
  scanCooldownSeconds: number;
  sessionMode: SessionMode;
  manualSessionId: string;
  appsScriptWebhookUrl?: string;
  lastSheetsSyncAt?: string;
  lastSheetsSyncStatus?: string;
}

export interface Teacher {
  id: string;
  name: string;
  nip: string;
  subject: string;
  barcodeCode: string;
  createdAt: string;
}

export interface ExamSession {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  description: string;
}

export interface AttendanceRecord {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherNip: string;
  barcodeCode: string;
  sessionId: string;
  sessionName: string;
  scannedAt: string;
  date: string;
  status: AttendanceStatus;
  deviceType: string;
  scanMethod: ScanMethod;
}

export interface BootstrapPayload {
  settings: InstitutionSettings;
  teachers: Teacher[];
  sessions: ExamSession[];
  attendances: AttendanceRecord[];
}

export interface ScanResultPayload {
  result: 'recorded' | 'already_scanned' | 'not_found';
  message: string;
  teacher?: Teacher;
  attendance?: AttendanceRecord;
  barcodeCode: string;
}

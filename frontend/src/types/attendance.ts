export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentMobile?: string;
  batchId: string;
  batchName: string;
  subject?: string;
  teacherId?: string;
  teacherName?: string;
  attendanceDate: string;
  status: 'PRESENT' | 'ABSENT';
  createdAt: string;
  updatedAt?: string;
}

export interface AttendanceSheetStudentRow {
  studentId: string;
  name: string;
  studentMobile?: string;
  parentWhatsapp?: string;
  status: 'PRESENT' | 'ABSENT' | 'UNMARKED';
  attendanceId?: string;
  feeOverdue?: { isOverdue: boolean; daysOverdue: number; pendingAmount: number } | null;
}

export interface AttendanceSheetResponse {
  batch: {
    id: string;
    name: string;
    subject?: string;
    schedule_days?: string[];
  };
  date: string;
  totalEnrolled: number;
  markedCount: number;
  students: AttendanceSheetStudentRow[];
}

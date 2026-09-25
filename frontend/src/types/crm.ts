export interface TeacherItem {
  id: string;
  profileId: string;
  fullName: string;
  email: string;
  phone: string;
  subject: string;
  status: 'ACTIVE' | 'INACTIVE';
  assignedBatchCount?: number;
  totalStudents?: number;
  assignedBatches?: Array<{
    id: string;
    name: string;
    subject?: string;
    scheduleDays?: string[];
    schedule_days?: string[];
    startTime?: string;
    start_time?: string;
    endTime?: string;
    end_time?: string;
    status?: string;
    studentCount?: number;
    students?: Array<{
      id: string;
      name: string;
      course?: string;
      studentMobile?: string;
      parentWhatsapp?: string;
      status?: string;
    }>;
  }>;
  enrolledStudents?: Array<{
    id: string;
    name: string;
    course?: string;
    studentMobile?: string;
    parentWhatsapp?: string;
    status?: string;
    batchId?: string;
    batchName?: string;
  }>;
  createdAt: string;
  updatedAt?: string;
}

export interface StudentItem {
  id: string;
  name: string;
  parentName: string;
  studentMobile: string;
  parentWhatsapp: string;
  email: string;
  course: string;
  admissionDate: string;
  monthlyFee: number;
  feeDueDay: number;
  status: 'ACTIVE' | 'INACTIVE';
  whatsappOptIn?: boolean;
  batchId?: string;
  batchName?: string;
  currentMonthFeeStatus?: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE' | 'NOT_ASSIGNED';
  currentMonthPendingAmount?: number;
  feeHistory?: Array<{
    id: string;
    billingPeriod: string;
    amountDue: number;
    amountPaid: number;
    pendingAmount: number;
    dueDate: string;
    status: string;
    createdAt: string;
  }>;
  enrolledBatches?: Array<{
    id: string;
    name: string;
    enrollmentStatus?: string;
    joinedAt?: string;
  }>;
  attendanceStats?: {
    totalSessions: number;
    presentCount: number;
    absentCount: number;
    attendanceRate: number;
  };
  attendanceHistory?: Array<{
    id: string;
    batchId: string;
    batchName: string;
    attendanceDate: string;
    status: 'PRESENT' | 'ABSENT';
  }>;
  createdAt: string;
  updatedAt?: string;
}

export interface BatchItem {
  id: string;
  name: string;
  subject: string;
  description?: string;
  monthlyFee?: number;
  scheduleDays: string[];
  startTime?: string;
  endTime?: string;
  status: 'ACTIVE' | 'INACTIVE';
  studentCount?: number;
  teacherCount?: number;
  assignedTeachers?: Array<{
    teacherId: string;
    fullName: string;
    subject: string;
    email?: string;
    phone?: string;
    status?: string;
  }>;
  enrolledStudents?: Array<{
    studentId: string;
    name: string;
    parentName?: string;
    studentMobile?: string;
    parentWhatsapp?: string;
    enrollmentStatus?: string;
    joinedAt?: string;
    currentMonthFeeStatus?: string;
    currentMonthPendingAmount?: number;
  }>;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminKPIs {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  activeTeachers: number;
  totalBatches: number;
  activeBatches: number;
  todayPresent?: number;
  todayTotal?: number;
  todayRate?: number;
  feesCollectedThisMonth?: number;
  feesPendingThisMonth?: number;
  feesExpectedThisMonth?: number;
  feesOverdueThisMonth?: number;
}

export interface MonthlyFeeSummary {
  expected: number;
  collected: number;
  pending: number;
  collectionPercentage: number;
}

export interface BatchFeeSummaryItem {
  id: string;
  name: string;
  studentCount: number;
  expected: number;
  collected: number;
  pending: number;
}

export interface FeeFollowupItem {
  feeId: string;
  studentId: string;
  studentName: string;
  batchId: string;
  batchName: string;
  parentName: string;
  parentWhatsapp: string;
  whatsappOptIn: boolean;
  billingPeriod: string;
  billingPeriodFormatted: string;
  amountDue: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: 'OVERDUE' | 'PARTIAL' | 'PENDING';
  consecutiveUnpaidCount: number;
  attentionLevel: 'CRITICAL' | 'REPEATED_PENDING' | 'FOLLOW_UP' | 'NORMAL';
  attentionBadge: string;
}

export interface RecentActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
}

export interface TeacherKPIs {
  assignedBatchCount: number;
  totalStudentCount: number;
}

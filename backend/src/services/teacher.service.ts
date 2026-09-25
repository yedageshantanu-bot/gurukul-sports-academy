import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';
import { ROLES, STATUS } from '../constants/index.js';
import { AuthenticatedUser } from '../types/auth.types.js';
import { CreateTeacherDTO, UpdateTeacherDTO } from '../types/crm.types.js';
import crypto from 'crypto';
import { automationService } from './whatsapp/automation.service.js';

export class TeacherService {
  /**
   * List all teachers with profile information and assigned batch counts (Admin only)
   */
  static async listTeachers(query: { search?: string; status?: string }) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    let dbQuery = supabaseAdmin
      .from('teachers')
      .select(`
        id,
        name,
        email,
        phone,
        profile_id,
        subject,
        status,
        created_at,
        updated_at,
        profiles (
          id,
          full_name,
          email,
          phone,
          status
        ),
        batch_teachers (
          batch_id
        )
      `)
      .order('created_at', { ascending: false });

    if (query.status && (query.status === STATUS.ACTIVE || query.status === STATUS.INACTIVE)) {
      dbQuery = dbQuery.eq('status', query.status);
    }

    const { data, error } = await dbQuery;

    if (error) {
      throw new AppError(`Failed to fetch teachers: ${error.message}`, 500);
    }

    let teachers = (data || []).map((t: any) => ({
      id: t.id,
      profileId: t.profile_id,
      fullName: t.profiles?.full_name || t.name || '',
      email: t.profiles?.email || t.email || '',
      phone: t.profiles?.phone || t.phone || '',
      subject: t.subject,
      status: t.status,
      assignedBatchCount: Array.isArray(t.batch_teachers) ? t.batch_teachers.length : 0,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    if (query.search) {
      const s = query.search.toLowerCase();
      teachers = teachers.filter(
        (t) =>
          t.fullName.toLowerCase().includes(s) ||
          t.email.toLowerCase().includes(s) ||
          (t.phone && t.phone.toLowerCase().includes(s)) ||
          (t.subject && t.subject.toLowerCase().includes(s))
      );
    }

    return teachers;
  }

  /**
   * Get single teacher details.
   * Authorized for: Admin OR the Teacher themself.
   */
  static async getTeacherById(id: string, requestingUser: AuthenticatedUser) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    // Role-based access check
    if (requestingUser.role === ROLES.TEACHER && requestingUser.teacherId !== id) {
      throw new AppError('You do not have permission to view another teacher profile.', 403, 'FORBIDDEN');
    }

    const { data: teacher, error } = await supabaseAdmin
      .from('teachers')
      .select(`
        id,
        profile_id,
        subject,
        status,
        created_at,
        updated_at,
        profiles!inner (
          id,
          full_name,
          email,
          phone,
          status
        ),
        batch_teachers (
          batch_id,
          batches (
            id,
            name,
            subject,
            schedule_days,
            start_time,
            end_time,
            status,
            batch_students (
              student_id,
              status,
              students (
                id,
                name,
                course,
                student_mobile,
                parent_whatsapp,
                status
              )
            )
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error || !teacher) {
      throw new AppError('Teacher not found', 404, 'NOT_FOUND');
    }

    const uniqueStudentMap = new Map<string, any>();

    const assignedBatches = (teacher.batch_teachers || [])
      .map((bt: any) => {
        const b = bt.batches;
        if (!b) return null;

        const students = (b.batch_students || [])
          .filter((bs: any) => bs.status === STATUS.ACTIVE || !bs.status)
          .map((bs: any) => {
            const s = bs.students;
            const item = {
              id: s?.id || bs.student_id,
              name: s?.name || 'Student',
              course: s?.course || '',
              studentMobile: s?.student_mobile || '',
              parentWhatsapp: s?.parent_whatsapp || '',
              status: s?.status || 'ACTIVE',
              batchId: b.id,
              batchName: b.name,
            };
            if (!uniqueStudentMap.has(item.id)) {
              uniqueStudentMap.set(item.id, item);
            }
            return item;
          });

        return {
          id: b.id,
          name: b.name,
          subject: b.subject,
          scheduleDays: b.schedule_days || [],
          startTime: b.start_time || '',
          endTime: b.end_time || '',
          status: b.status,
          studentCount: students.length,
          students,
        };
      })
      .filter(Boolean);

    const prof = (Array.isArray(teacher.profiles) ? teacher.profiles[0] : teacher.profiles) as any;

    return {
      id: teacher.id,
      profileId: teacher.profile_id,
      fullName: prof?.full_name || '',
      email: prof?.email || '',
      phone: prof?.phone || '',
      subject: teacher.subject,
      status: teacher.status,
      assignedBatches,
      assignedBatchCount: assignedBatches.length,
      totalStudents: uniqueStudentMap.size,
      enrolledStudents: Array.from(uniqueStudentMap.values()),
      createdAt: teacher.created_at,
      updatedAt: teacher.updated_at,
    };
  }

  /**
   * Create a new teacher (Admin only)
   * Creates Supabase Auth user -> creates profile -> creates teacher row
   */
  static async createTeacher(dto: CreateTeacherDTO) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    const password = dto.password || `Teacher@${crypto.randomBytes(4).toString('hex')}!`;

    // 1. Create or verify Supabase Auth user
    let authUserId: string;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: dto.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: dto.fullName,
        role: ROLES.TEACHER,
      },
    });

    if (authError) {
      // Check if user already exists in auth
      if (authError.message.toLowerCase().includes('already registered')) {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existing = listData?.users.find((u) => u.email?.toLowerCase() === dto.email.toLowerCase());
        if (existing) {
          authUserId = existing.id;
        } else {
          throw new AppError(`User with email ${dto.email} exists in Auth but could not be resolved`, 400);
        }
      } else {
        throw new AppError(`Failed to create teacher credentials: ${authError.message}`, 400);
      }
    } else {
      authUserId = authData.user.id;
    }

    // 2. Upsert profile with role TEACHER
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
      {
        id: authUserId,
        role: ROLES.TEACHER,
        full_name: dto.fullName,
        email: dto.email,
        phone: dto.phone || null,
        status: STATUS.ACTIVE,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      throw new AppError(`Failed to save teacher profile: ${profileError.message}`, 500);
    }

    // 3. Upsert teacher record
    const { data: teacher, error: teacherError } = await supabaseAdmin
      .from('teachers')
      .upsert(
        {
          profile_id: authUserId,
          name: dto.fullName,
          email: dto.email,
          phone: dto.phone || null,
          subject: dto.subject,
          status: STATUS.ACTIVE,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id' }
      )
      .select()
      .single();

    if (teacherError || !teacher) {
      throw new AppError(`Failed to create teacher record: ${teacherError?.message}`, 500);
    }

    // Automatically dispatch teacher portal credentials via WhatsApp if phone provided
    if (dto.phone) {
      automationService
        .triggerTeacherWelcomeAutomation({
          fullName: dto.fullName,
          email: dto.email,
          password: password,
          phone: dto.phone,
        })
        .catch((err) => console.warn('[TeacherService] Failed to dispatch teacher WhatsApp credentials:', err.message));
    }

    return {
      id: teacher.id,
      profileId: authUserId,
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone || '',
      subject: teacher.subject,
      status: teacher.status,
      createdAt: teacher.created_at,
    };
  }

  /**
   * Update teacher details (Admin only)
   */
  static async updateTeacher(id: string, dto: UpdateTeacherDTO) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    const { data: teacher, error: fetchErr } = await supabaseAdmin
      .from('teachers')
      .select('profile_id, status')
      .eq('id', id)
      .single();

    if (fetchErr || !teacher) {
      throw new AppError('Teacher not found', 404, 'NOT_FOUND');
    }

    // 1. Update profiles if name/phone/status changed
    const profileUpdates: any = { updated_at: new Date().toISOString() };
    if (dto.fullName) profileUpdates.full_name = dto.fullName;
    if (dto.phone !== undefined) profileUpdates.phone = dto.phone || null;
    if (dto.status) profileUpdates.status = dto.status;

    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdates)
      .eq('id', teacher.profile_id);

    if (profileErr) {
      throw new AppError(`Failed to update teacher profile: ${profileErr.message}`, 500);
    }

    // 2. Update teachers table
    const teacherUpdates: any = { updated_at: new Date().toISOString() };
    if (dto.fullName) teacherUpdates.name = dto.fullName;
    if (dto.phone !== undefined) teacherUpdates.phone = dto.phone || null;
    if (dto.subject) teacherUpdates.subject = dto.subject;
    if (dto.status) teacherUpdates.status = dto.status;

    const { data: updatedTeacher, error: teacherErr } = await supabaseAdmin
      .from('teachers')
      .update(teacherUpdates)
      .eq('id', id)
      .select(`
        id,
        profile_id,
        subject,
        status,
        updated_at,
        profiles!inner (
          full_name,
          email,
          phone
        )
      `)
      .single();

    if (teacherErr || !updatedTeacher) {
      throw new AppError(`Failed to update teacher record: ${teacherErr?.message}`, 500);
    }

    const p = updatedTeacher.profiles as any;
    return {
      id: updatedTeacher.id,
      profileId: updatedTeacher.profile_id,
      fullName: p?.full_name,
      email: p?.email,
      phone: p?.phone,
      subject: updatedTeacher.subject,
      status: updatedTeacher.status,
      updatedAt: updatedTeacher.updated_at,
    };
  }

  /**
   * Toggle teacher status (Activate / Deactivate)
   */
  static async setTeacherStatus(id: string, targetStatus: 'ACTIVE' | 'INACTIVE') {
    return this.updateTeacher(id, { status: targetStatus });
  }

  /**
   * Permanently delete a teacher and cleanup foreign references safely
   */
  static async deleteTeacher(id: string) {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }

    const { data: teacher, error: fetchErr } = await supabaseAdmin
      .from('teachers')
      .select('id, profile_id')
      .eq('id', id)
      .single();

    if (fetchErr || !teacher) {
      throw new AppError('Teacher not found', 404, 'NOT_FOUND');
    }

    // 1. Remove teacher assignments from batches
    await supabaseAdmin.from('batch_teachers').delete().eq('teacher_id', id);

    // 2. Handle attendance records marked by this teacher
    const { data: fallbackTeacher } = await supabaseAdmin
      .from('teachers')
      .select('id')
      .neq('id', id)
      .limit(1)
      .maybeSingle();

    if (fallbackTeacher?.id) {
      await supabaseAdmin.from('attendance').update({ teacher_id: fallbackTeacher.id }).eq('teacher_id', id);
    } else {
      await supabaseAdmin.from('attendance').delete().eq('teacher_id', id);
    }

    // 3. Delete teacher record
    const { error: delTeacherErr } = await supabaseAdmin
      .from('teachers')
      .delete()
      .eq('id', id);

    if (delTeacherErr) {
      throw new AppError(`Failed to delete teacher: ${delTeacherErr.message}`, 500);
    }

    // 4. Delete profile if exists
    if (teacher.profile_id) {
      await supabaseAdmin.from('profiles').delete().eq('id', teacher.profile_id);
    }

    return { id, success: true };
  }
}

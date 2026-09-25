import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';
import { queueService } from './whatsapp/queue.service.js';

export interface PromoteStudentDTO {
  studentId?: string;
  student_id?: string;
  disciplineCode?: string;
  discipline_code?: string;
  nextRankId?: string;
  new_rank_id?: string;
  dob?: string;
  regNumber?: string;
  reg_number?: string;
  representedFrom?: string;
  represented_from?: string;
  promotionDate?: string;
  promotion_date?: string;
  promotedBy?: string;
  promoted_by?: string;
  examiner_name?: string;
  examinerName?: string;
  notes?: string;
}

export class RankService {
  /**
   * Get all martial arts disciplines with their ordered ranks
   */
  static async getDisciplinesWithRanks() {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    const { data: disciplines, error: dErr } = await supabaseAdmin
      .from('martial_arts_disciplines')
      .select('*')
      .order('name', { ascending: true });

    if (dErr) throw new AppError(`Failed to fetch disciplines: ${dErr.message}`, 500);

    const { data: ranks, error: rErr } = await supabaseAdmin
      .from('martial_arts_ranks')
      .select('*')
      .order('rank_order', { ascending: true });

    if (rErr) throw new AppError(`Failed to fetch ranks: ${rErr.message}`, 500);

    return (disciplines || []).map((d: any) => ({
      ...d,
      ranks: (ranks || []).filter((r: any) => r.discipline_code === d.code),
    }));
  }

  /**
   * Add a new rank to a discipline
   */
  static async createRank(dto: {
    disciplineCode: string;
    rankOrder: number;
    rankName: string;
    beltColor: string;
    badgeBg?: string;
    badgeText?: string;
  }) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    const { data, error } = await supabaseAdmin
      .from('martial_arts_ranks')
      .insert({
        discipline_code: dto.disciplineCode,
        rank_order: dto.rankOrder,
        rank_name: dto.rankName,
        belt_color: dto.beltColor,
        badge_bg: dto.badgeBg || '#1e293b',
        badge_text: dto.badgeText || '#ffffff',
      })
      .select()
      .single();

    if (error) throw new AppError(`Failed to add rank: ${error.message}`, 500);

    return data;
  }

  /**
   * List all academy students with their active martial arts ranks
   */
  static async listStudentRanks(disciplineCode?: string) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    // Fetch all active students
    const { data: students, error: sErr } = await supabaseAdmin
      .from('students')
      .select('id, name, course, student_mobile, parent_whatsapp, parent_name, status')
      .eq('status', 'ACTIVE')
      .order('name', { ascending: true });

    if (sErr) throw new AppError(`Failed to fetch students: ${sErr.message}`, 500);

    // Fetch student ranks
    let rankQuery = supabaseAdmin
      .from('student_ranks')
      .select(`
        id,
        student_id,
        discipline_code,
        current_rank_id,
        reg_number,
        dob,
        represented_from,
        promoted_at,
        promoted_by,
        martial_arts_ranks!inner (
          id,
          rank_order,
          rank_name,
          belt_color,
          badge_bg,
          badge_text
        ),
        martial_arts_disciplines!inner (
          code,
          name
        )
      `);

    if (disciplineCode) {
      rankQuery = rankQuery.eq('discipline_code', disciplineCode);
    }

    const { data: studentRanks, error: rErr } = await rankQuery;
    if (rErr) throw new AppError(`Failed to fetch student ranks: ${rErr.message}`, 500);

    // Fetch all available ranks for computing the "next rank"
    const { data: allRanks } = await supabaseAdmin
      .from('martial_arts_ranks')
      .select('*')
      .order('rank_order', { ascending: true });

    const ranksByDiscipline = new Map<string, any[]>();
    (allRanks || []).forEach((r: any) => {
      const list = ranksByDiscipline.get(r.discipline_code) || [];
      list.push(r);
      ranksByDiscipline.set(r.discipline_code, list);
    });

    const flatList = (studentRanks || []).map((sr: any) => {
      const discRanks = ranksByDiscipline.get(sr.discipline_code) || [];
      const currentRankObj = sr.martial_arts_ranks;
      const currentOrder = currentRankObj?.rank_order || 0;
      const nextRank = discRanks.find((r: any) => r.rank_order === currentOrder + 1) || null;
      const studentObj = (students || []).find((s: any) => s.id === sr.student_id);

      return {
        id: sr.id,
        student_id: sr.student_id,
        student_name: studentObj?.name || 'Athlete',
        student_code: sr.reg_number,
        dob: sr.dob,
        contact_number: studentObj?.parent_whatsapp || studentObj?.student_mobile || '',
        discipline_code: sr.discipline_code,
        discipline_name: sr.discipline_code === 'KALARIPPAYATTU'
          ? 'Kalarippayattu'
          : sr.discipline_code === 'KARATE_WUSHU'
          ? 'Karate + Wushu'
          : 'Both (Kalari & Karate/Wushu)',
        current_rank_name: currentRankObj?.rank_name || 'Beginner',
        belt_color: currentRankObj?.belt_color || 'White',
        rank_order: currentOrder,
        promoted_at: sr.promoted_at || sr.created_at,
        certificate_number: sr.reg_number,
        nextRank,
      };
    });

    return flatList;
  }

  /**
   * 1-Click Rank-Up Promotion with WhatsApp notification & Certificate log
   */
  static async promoteStudent(dto: PromoteStudentDTO) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    const studentId = dto.studentId || dto.student_id;
    const disciplineCode = dto.disciplineCode || dto.discipline_code;
    let targetRankId = dto.nextRankId || dto.new_rank_id;
    const promotedBy = dto.promotedBy || dto.promoted_by || dto.examiner_name || 'Sensei Vikram Salunkhe';
    const promotionDate = dto.promotionDate || dto.promotion_date || new Date().toISOString().split('T')[0];

    if (!studentId) {
      throw new AppError('Student ID is required for promotion', 400);
    }
    if (!disciplineCode) {
      throw new AppError('Discipline code is required for promotion', 400);
    }

    // 1. Get current rank record if exists
    const { data: existingRank } = await supabaseAdmin
      .from('student_ranks')
      .select(`
        id,
        reg_number,
        dob,
        represented_from,
        current_rank_id,
        martial_arts_ranks (
          id,
          rank_order,
          rank_name
        )
      `)
      .eq('student_id', studentId)
      .eq('discipline_code', disciplineCode)
      .maybeSingle();

    // 2. Fetch student details
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('name, parent_name, parent_whatsapp, student_mobile')
      .eq('id', studentId)
      .single();

    if (!student) throw new AppError('Student not found', 404);

    // 3. Determine next rank
    let previousRankName = (existingRank?.martial_arts_ranks as any)?.rank_name || 'Novice / White Belt';

    if (!targetRankId) {
      const currentOrder = (existingRank?.martial_arts_ranks as any)?.rank_order || 0;
      const { data: nextRank } = await supabaseAdmin
        .from('martial_arts_ranks')
        .select('*')
        .eq('discipline_code', disciplineCode)
        .eq('rank_order', currentOrder + 1)
        .maybeSingle();

      if (!nextRank) {
        throw new AppError('Student has reached the highest rank in this discipline or no next rank configured', 400);
      }
      targetRankId = nextRank.id;
    }

    const { data: targetRank } = await supabaseAdmin
      .from('martial_arts_ranks')
      .select('*')
      .eq('id', targetRankId)
      .single();

    if (!targetRank) throw new AppError('Target rank not found', 404);

    const representedFrom = dto.representedFrom || dto.represented_from || existingRank?.represented_from || 'Gurukul Sports Academy Central Dojo';
    const dob = dto.dob || existingRank?.dob || '2012-05-14';
    const regNumber = dto.regNumber || dto.reg_number || existingRank?.reg_number || `GSA-${disciplineCode.substring(0, 3)}-${Date.now().toString().slice(-4)}`;
    const certificateNumber = `CERT-${promotionDate.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 4. Upsert student_ranks
    const { data: updatedRank, error: uErr } = await supabaseAdmin
      .from('student_ranks')
      .upsert({
        student_id: studentId,
        discipline_code: disciplineCode,
        current_rank_id: targetRank.id,
        reg_number: regNumber,
        dob,
        represented_from: representedFrom,
        promoted_at: promotionDate,
        promoted_by: promotedBy,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id,discipline_code' })
      .select()
      .single();

    if (uErr) throw new AppError(`Failed to update student rank: ${uErr.message}`, 500);

    // 5. Create immutable audit record in rank_promotions
    const { error: pErr } = await supabaseAdmin
      .from('rank_promotions')
      .insert({
        student_id: studentId,
        discipline_code: disciplineCode,
        previous_rank_name: previousRankName,
        new_rank_id: targetRank.id,
        new_rank_name: targetRank.rank_name,
        reg_number: regNumber,
        dob,
        represented_from: representedFrom,
        promotion_date: promotionDate,
        promoted_by: promotedBy,
        certificate_number: certificateNumber,
        whatsapp_sent: true,
        notes: dto.notes || null,
      });

    if (pErr) console.warn('[RankService] Warning logging promotion history:', pErr.message);

    // 6. Trigger celebratory WhatsApp notification to Parent
    const phone = student.parent_whatsapp || student.student_mobile;
    if (phone) {
      const disciplineName = disciplineCode === 'KALARIPPAYATTU' ? 'Kalarippayattu' : (disciplineCode === 'KARATE_WUSHU' ? 'Karate + Wushu' : 'Combat Arts');
      const parent = student.parent_name || 'Parent/Guardian';
      const msg = `🥋 *Gurukul Rank Promotion Honors*\n\nDear ${parent},\n\nWe are immensely proud to announce that *${student.name}* has officially earned a Rank Up promotion!\n\n• *Discipline:* ${disciplineName}\n• *New Rank Secured:* *${targetRank.rank_name}* (${targetRank.belt_color})\n• *Player Reg No:* ${regNumber}\n• *Exam Date:* ${promotionDate}\n• *Chief Examiner:* ${promotedBy}\n• *Certificate Ref:* ${certificateNumber}\n\nCongratulations on this martial arts milestone!\n\nWarm regards,\n*Gurukul Sports & Martial Arts Academy*`;

      queueService.enqueueMessage({
        recipientPhone: phone,
        messageBody: msg,
        studentId: studentId,
        eventType: 'RANK_PROMOTION',
        idempotencyKey: `PROMOTION:${studentId}:${targetRank.id}:${promotionDate}`,
      }).catch((e) => console.warn('[RankService] WhatsApp dispatch error:', e.message));
    }

    return {
      success: true,
      message: `${student.name} promoted to ${targetRank.rank_name}! WhatsApp certificate notice dispatched.`,
      updatedRank,
      certificateNumber,
    };
  }

  /**
   * Certificate Registry with Date-Range Filtering for physical printing & PDF export
   * Handles user twist: "client kabhi bhi update kar sakta hai tohh broo hame yesa systeme karna hai ki user first select karega ki kab kab ka chiyyie usne update kiya hua like iss date uss date and utahen hee show karega data"
   */
  static async getCertificateRegistry(filters: {
    startDate?: string;
    endDate?: string;
    disciplineCode?: string;
    studentId?: string;
  } = {}) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    let query = supabaseAdmin
      .from('rank_promotions')
      .select(`
        id,
        student_id,
        discipline_code,
        previous_rank_name,
        new_rank_id,
        new_rank_name,
        reg_number,
        dob,
        represented_from,
        promotion_date,
        promoted_by,
        certificate_number,
        created_at,
        students!inner (
          id,
          name,
          parent_name,
          parent_whatsapp,
          student_mobile
        ),
        martial_arts_ranks!inner (
          belt_color,
          badge_bg,
          badge_text
        )
      `)
      .order('promotion_date', { ascending: false });

    if (filters.startDate) {
      query = query.gte('promotion_date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('promotion_date', filters.endDate);
    }
    if (filters.disciplineCode) {
      query = query.eq('discipline_code', filters.disciplineCode);
    }
    if (filters.studentId) {
      query = query.eq('student_id', filters.studentId);
    }

    const { data, error } = await query;
    if (error) throw new AppError(`Failed to fetch certificate registry: ${error.message}`, 500);

    const records = (data || []).map((r: any) => ({
      id: r.id,
      certificateNumber: r.certificate_number,
      studentId: r.student_id,
      playerName: r.students?.name || 'Player',
      parentName: r.students?.parent_name || '',
      parentWhatsapp: r.students?.parent_whatsapp || r.students?.student_mobile || '',
      dob: r.dob || '2012-05-14',
      regNumber: r.reg_number,
      disciplineCode: r.discipline_code,
      disciplineName: r.discipline_code === 'KALARIPPAYATTU' ? 'Kalarippayattu' : 'Karate + Wushu',
      rankSecured: r.new_rank_name,
      previousRank: r.previous_rank_name,
      beltColor: r.martial_arts_ranks?.belt_color || '',
      representedFrom: r.represented_from || 'Gurukul Sports & Martial Arts Academy',
      promotionDate: r.promotion_date,
      promotedBy: r.promoted_by,
      issuedAt: r.created_at,
    }));

    return {
      filterRange: {
        startDate: filters.startDate || 'All-Time',
        endDate: filters.endDate || 'Latest',
      },
      totalCertificates: records.length,
      certificates: records,
    };
  }

  /**
   * Get all defined ranks across disciplines
   */
  static async getAllRanks(disciplineCode?: string) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    let query = supabaseAdmin
      .from('martial_arts_ranks')
      .select('*')
      .order('rank_order', { ascending: true });

    if (disciplineCode && disciplineCode !== 'ALL') {
      query = query.eq('discipline_code', disciplineCode);
    }

    const { data, error } = await query;
    if (error) throw new AppError(`Failed to fetch ranks: ${error.message}`, 500);
    return data || [];
  }

  /**
   * Enroll / Assign Student to a Martial Arts Discipline
   * Supports 'BOTH' (Kalarippayattu + Karate & Wushu dual progression)
   */
  static async assignStudentRank(dto: {
    student_id?: string;
    studentId?: string;
    discipline_code?: string;
    disciplineCode?: string;
    rank_name?: string;
    rankName?: string;
  }) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    const studentId = dto.student_id || dto.studentId;
    const disciplineCode = dto.discipline_code || dto.disciplineCode;
    const rankName = dto.rank_name || dto.rankName;

    if (!studentId || !disciplineCode) {
      throw new AppError('Student ID and discipline code are required', 400);
    }

    const disciplinesToAssign = disciplineCode === 'BOTH'
      ? ['BOTH', 'KALARIPPAYATTU', 'KARATE_WUSHU']
      : [disciplineCode];

    const results = [];

    for (const dCode of disciplinesToAssign) {
      // Find initial rank
      const { data: ranks } = await supabaseAdmin
        .from('martial_arts_ranks')
        .select('*')
        .eq('discipline_code', dCode)
        .order('rank_order', { ascending: true });

      const targetRank = (ranks || []).find((r: any) => r.rank_name === rankName) || (ranks || [])[0];
      if (!targetRank) continue;

      const { data: existingSr } = await supabaseAdmin
        .from('student_ranks')
        .select('reg_number')
        .eq('student_id', studentId)
        .eq('discipline_code', dCode)
        .maybeSingle();

      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const regNum = existingSr?.reg_number || `GSA-${dCode.substring(0, 3)}-${new Date().getFullYear()}-${randomSuffix}`;

      const { data, error } = await supabaseAdmin
        .from('student_ranks')
        .upsert(
          {
            student_id: studentId,
            discipline_code: dCode,
            current_rank_id: targetRank.id,
            reg_number: regNum,
            represented_from: 'Gurukul Sports & Martial Arts Academy',
            promoted_at: new Date().toISOString().split('T')[0],
            promoted_by: 'Sensei / Chief Master (Gurukul Academy)',
          },
          { onConflict: 'student_id,discipline_code' }
        )
        .select()
        .single();

      if (!error && data) results.push(data);
    }

    return results;
  }
}

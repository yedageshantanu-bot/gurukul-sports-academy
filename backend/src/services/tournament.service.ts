import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';
import { queueService } from './whatsapp/queue.service.js';

export interface CreateTournamentDTO {
  name?: string;
  title?: string;
  discipline?: string;
  discipline_code?: string;
  organizer?: string;
  venue: string;
  tournamentDate?: string;
  tournament_date?: string;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  registrationDeadline?: string;
  registration_deadline?: string;
  entryFee?: number;
  entry_fee?: number | string;
  status?: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  description?: string;
}

export interface NominateStudentsDTO {
  studentIds?: string[];
  student_ids?: string[];
  category?: string;
  entryFee?: number;
  entry_fee?: number | string;
  notes?: string;
  sendWhatsApp?: boolean;
  scheduleTime?: string;
}

export class TournamentService {
  /**
   * List all tournaments with statistics (registered count, settled fees)
   */
  static async listTournaments() {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    const { data: tournaments, error } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .order('tournament_date', { ascending: false });

    if (error) throw new AppError(`Failed to fetch tournaments: ${error.message}`, 500);

    // Get registrations for each tournament to compute participant counts and revenue
    const { data: registrations } = await supabaseAdmin
      .from('tournament_registrations')
      .select('tournament_id, fee_amount, amount_paid, payment_status');

    const statsMap = new Map<string, { participants: number; expected: number; collected: number; pending: number }>();
    (registrations || []).forEach((r: any) => {
      const existing = statsMap.get(r.tournament_id) || { participants: 0, expected: 0, collected: 0, pending: 0 };
      existing.participants += 1;
      const due = Number(r.fee_amount || 0);
      const paid = Number(r.amount_paid || 0);
      existing.expected += due;
      existing.collected += paid;
      existing.pending += Math.max(0, due - paid);
      statsMap.set(r.tournament_id, existing);
    });

    const enriched = (tournaments || []).map((t: any) => {
      const stats = statsMap.get(t.id) || { participants: 0, expected: 0, collected: 0, pending: 0 };
      return {
        ...t,
        title: t.title || t.name || 'Untitled Tournament',
        name: t.name || t.title || 'Untitled Tournament',
        discipline_code: t.discipline_code || t.discipline || 'KALARIPPAYATTU',
        venue: t.venue || 'Gurukul Sports Ground',
        start_date: t.start_date || t.tournament_date || '',
        end_date: t.end_date || t.tournament_date || '',
        registration_deadline: t.registration_deadline || t.tournament_date || '',
        entry_fee: Number(t.entry_fee || 0),
        registrationCount: stats.participants,
        totalCollected: stats.collected,
        totalPending: stats.pending,
        stats,
      };
    });

    const summary = {
      totalTournaments: enriched.length,
      upcomingCount: enriched.filter((t: any) => t.status === 'UPCOMING').length,
      totalAthletesNominated: enriched.reduce((sum: number, t: any) => sum + (t.registrationCount || 0), 0),
      totalRevenueCollected: enriched.reduce((sum: number, t: any) => sum + (t.totalCollected || 0), 0),
      totalDuesPending: enriched.reduce((sum: number, t: any) => sum + (t.stats?.pending || 0), 0),
    };

    return { tournaments: enriched, summary };
  }

  /**
   * Create a new tournament
   */
  static async createTournament(dto: CreateTournamentDTO) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    const name = dto.name || dto.title;
    const venue = dto.venue;
    const tournamentDate = dto.tournamentDate || dto.tournament_date || dto.startDate || dto.start_date;
    const registrationDeadline = dto.registrationDeadline || dto.registration_deadline || tournamentDate;
    const discipline = dto.discipline || dto.discipline_code || 'General Sports';
    const organizer = dto.organizer || 'Gurukul Sports Federation';
    const entryFee = dto.entryFee !== undefined ? Number(dto.entryFee) : (dto.entry_fee !== undefined ? Number(dto.entry_fee) : 1000);
    const status = dto.status || 'UPCOMING';
    const description = dto.description || '';

    if (!name || !venue || !tournamentDate) {
      throw new AppError('Tournament name, venue, and date are required', 400);
    }

    const { data, error } = await supabaseAdmin
      .from('tournaments')
      .insert({
        name,
        discipline,
        organizer,
        venue,
        tournament_date: tournamentDate,
        registration_deadline: registrationDeadline,
        entry_fee: entryFee,
        status,
        description,
      })
      .select()
      .single();

    if (error) throw new AppError(`Failed to create tournament: ${error.message}`, 500);

    return {
      ...data,
      title: data.name,
      discipline_code: data.discipline,
      start_date: data.tournament_date,
    };
  }

  /**
   * Get tournament details with all registered students
   */
  static async getTournamentDetails(tournamentId: string) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    const { data: tournament, error } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (error || !tournament) throw new AppError('Tournament not found', 404);

    const { data: registrations, error: rErr } = await supabaseAdmin
      .from('tournament_registrations')
      .select(`
        id,
        tournament_id,
        student_id,
        category,
        fee_amount,
        amount_paid,
        payment_status,
        payment_method,
        payment_date,
        settlement_notes,
        selection_status,
        whatsapp_notified,
        created_at,
        students (
          id,
          name,
          parent_name,
          parent_whatsapp,
          student_mobile
        )
      `)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false });

    if (rErr) throw new AppError(`Failed to fetch tournament registrations: ${rErr.message}`, 500);

    const totalExpected = (registrations || []).reduce((acc, r: any) => acc + Number(r.fee_amount || 0), 0);
    const totalCollected = (registrations || []).reduce((acc, r: any) => acc + Number(r.amount_paid || 0), 0);
    const totalPending = Math.max(0, totalExpected - totalCollected);

    const mappedTournament = {
      ...tournament,
      title: tournament.name || tournament.title || 'Untitled Tournament',
      name: tournament.name || tournament.title || 'Untitled Tournament',
      discipline_code: tournament.discipline_code || tournament.discipline || 'KALARIPPAYATTU',
      start_date: tournament.start_date || tournament.tournament_date || '',
      end_date: tournament.end_date || tournament.tournament_date || '',
      registration_deadline: tournament.registration_deadline || tournament.tournament_date || '',
      entry_fee: Number(tournament.entry_fee || 0),
      stats: {
        participants: registrations?.length || 0,
        expected: totalExpected,
        collected: totalCollected,
        pending: totalPending,
      },
    };

    return {
      tournament: mappedTournament,
      registrations: registrations || [],
    };
  }

  /**
   * Nominate / Select multiple students for a tournament and dispatch WhatsApp notifications
   */
  /**
   * Nominate / Select multiple students for a tournament and dispatch WhatsApp notifications
   */
  static async nominateStudents(tournamentId: string, dto: NominateStudentsDTO) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    const studentIds = dto.studentIds || dto.student_ids || [];
    if (!studentIds || studentIds.length === 0) {
      throw new AppError('At least one student must be selected for nomination', 400);
    }

    const { data: tournament, error: tErr } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tErr || !tournament) throw new AppError('Tournament not found', 404);

    const rawFee = dto.entryFee !== undefined ? dto.entryFee : dto.entry_fee;
    const fee = rawFee !== undefined ? Number(rawFee) : Number(tournament.entry_fee || 1000);
    const shouldSendWhatsApp = dto.sendWhatsApp === true;
    const scheduledTimeMs = dto.scheduleTime ? new Date(dto.scheduleTime).getTime() : Date.now();

    const rows = studentIds.map((studentId) => ({
      tournament_id: tournamentId,
      student_id: studentId,
      category: dto.category || 'General Division',
      fee_amount: fee,
      amount_paid: 0.00,
      payment_status: 'PENDING',
      selection_status: 'SELECTED',
      whatsapp_notified: shouldSendWhatsApp,
    }));

    const { data, error } = await supabaseAdmin
      .from('tournament_registrations')
      .upsert(rows, { onConflict: 'tournament_id,student_id' })
      .select(`
        id,
        student_id,
        tournament_id,
        students!inner (
          id,
          name,
          parent_name,
          parent_whatsapp,
          student_mobile
        )
      `);

    if (error) throw new AppError(`Failed to nominate students: ${error.message}`, 500);

    // Send WhatsApp notification ONLY if admin chose to dispatch or schedule
    if (shouldSendWhatsApp) {
      (data || []).forEach((reg: any) => {
        const s = reg.students;
        const phone = s?.parent_whatsapp || s?.student_mobile;
        if (phone) {
          const msg = `🏆 *Tournament Selection Notice - Gurukul Sports Academy*\n\nCongratulations! *${s.name}* has been officially selected to represent our academy in:\n\n• *Tournament:* ${tournament.name}\n• *Discipline:* ${tournament.discipline}\n• *Date:* ${tournament.tournament_date}\n• *Venue:* ${tournament.venue}\n• *Entry Fee:* ₹${fee.toLocaleString('en-IN')}\n\nKindly confirm your entry with the academy coach.\n\nWarm regards,\n*Gurukul Sports & Martial Arts Academy*`;
          
          queueService.enqueueMessage({
            recipientPhone: phone,
            messageBody: msg,
            studentId: s.id,
            eventType: 'TOURNAMENT_SELECTION',
            idempotencyKey: `TOURNAMENT:${tournamentId}:${s.id}`,
            scheduledAt: dto.scheduleTime ? new Date(dto.scheduleTime).toISOString() : undefined,
          }).catch((e) => console.warn('[TournamentService] WhatsApp dispatch error:', e.message));
        }
      });
    }

    return {
      nominatedCount: data?.length || 0,
      registrations: data,
    };
  }

  /**
   * Settle tournament fee for a registered student (Cash, UPI, Razorpay)
   */
  static async settleRegistrationFee(
    registrationId: string,
    settlement: any
  ) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    const { data: reg, error: fErr } = await supabaseAdmin
      .from('tournament_registrations')
      .select('fee_amount')
      .eq('id', registrationId)
      .single();

    if (fErr || !reg) throw new AppError('Tournament registration record not found', 404);

    const amountPaid = settlement.amountPaid !== undefined 
      ? Number(settlement.amountPaid) 
      : (settlement.amount_paid !== undefined ? Number(settlement.amount_paid) : 0);
    const paymentMethod = settlement.paymentMethod || settlement.payment_method || 'UPI';
    const settlementNotes = settlement.settlementNotes || settlement.settlement_notes || settlement.transaction_ref || null;
    const paymentStatus = settlement.payment_status || (amountPaid >= Number(reg.fee_amount) ? 'PAID' : 'PENDING');
    const selectionStatus = settlement.selectionStatus || settlement.selection_status || (paymentStatus === 'PAID' ? 'CONFIRMED' : 'SELECTED');
    const rawDate = settlement.payment_date || settlement.paymentDate || settlement.paid_at;
    const paymentDate = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('tournament_registrations')
      .update({
        amount_paid: amountPaid,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        payment_date: paymentDate,
        selection_status: selectionStatus,
        settlement_notes: settlementNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId)
      .select()
      .single();

    if (error) throw new AppError(`Failed to update tournament settlement: ${error.message}`, 500);

    return data;
  }

  /**
   * Send WhatsApp notification to an individual registered athlete
   */
  static async notifyRegistration(registrationId: string, customMessage?: string) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    const { data: reg, error: rErr } = await supabaseAdmin
      .from('tournament_registrations')
      .select(`
        id,
        tournament_id,
        fee_amount,
        amount_paid,
        payment_status,
        selection_status,
        payment_date,
        tournaments (
          id,
          name,
          title,
          discipline,
          tournament_date,
          registration_deadline,
          venue,
          entry_fee
        ),
        students (
          id,
          name,
          parent_name,
          parent_whatsapp,
          student_mobile
        )
      `)
      .eq('id', registrationId)
      .single();

    if (rErr || !reg) throw new AppError('Tournament registration record not found', 404);

    const s = reg.students as any;
    const t = reg.tournaments as any;
    const phone = s?.parent_whatsapp || s?.student_mobile;
    if (!phone) {
      throw new AppError('Student does not have a registered contact phone for WhatsApp', 400);
    }

    const tourName = t?.title || t?.name || 'Championship';
    const due = Math.max(0, Number(reg.fee_amount || 0) - Number(reg.amount_paid || 0));
    const deadlineStr = t?.registration_deadline ? new Date(t.registration_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBA';
    const dateStr = t?.tournament_date ? new Date(t.tournament_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBA';

    let msg = '';
    if (customMessage && customMessage.trim()) {
      msg = customMessage.trim();
    } else {
      msg = `🏆 *Tournament Update - Gurukul Sports Academy*\n\nHello *${s.name}*,\n\nYou are registered for:\n• *Tournament:* ${tourName}\n• *Date:* ${dateStr}\n• *Venue:* ${t?.venue || 'Gurukul Sports Ground'}\n• *Entry Fee:* ₹${Number(reg.fee_amount || 0).toLocaleString('en-IN')}\n• *Paid:* ₹${Number(reg.amount_paid || 0).toLocaleString('en-IN')}\n• *Pending Dues:* ₹${due.toLocaleString('en-IN')}\n• *Fee Payment Deadline:* ${deadlineStr}\n\n${due > 0 ? '⚠️ *Please settle your pending entry fee before the deadline.*' : '✅ *Your entry fee is fully settled. All the best!*'}\n\nWarm regards,\n*Gurukul Sports & Martial Arts Academy*`;
    }

    await queueService.enqueueMessage({
      recipientPhone: phone,
      messageBody: msg,
      studentId: s.id,
      eventType: 'TOURNAMENT_UPDATE',
      idempotencyKey: `TOURNAMENT_NOTIFY:${registrationId}:${Date.now()}`,
    });

    await supabaseAdmin
      .from('tournament_registrations')
      .update({
        whatsapp_notified: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', registrationId);

    return { success: true, message: `WhatsApp alert sent to ${s.name} (${phone})` };
  }

  /**
   * Broadcast WhatsApp message to tournament athletes (with filters & deadline)
   */
  static async broadcastTournamentWhatsApp(
    tournamentId: string,
    options: { recipientFilter?: 'ALL' | 'PENDING_FEE' | 'SELECTED'; customMessage?: string; includeDeadline?: boolean }
  ) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    const { data: tournament, error: tErr } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tErr || !tournament) throw new AppError('Tournament not found', 404);

    const { data: registrations, error: rErr } = await supabaseAdmin
      .from('tournament_registrations')
      .select(`
        id,
        fee_amount,
        amount_paid,
        payment_status,
        selection_status,
        students (
          id,
          name,
          parent_name,
          parent_whatsapp,
          student_mobile
        )
      `)
      .eq('tournament_id', tournamentId);

    if (rErr) throw new AppError(`Failed to fetch registrations: ${rErr.message}`, 500);

    let filtered = registrations || [];
    if (options.recipientFilter === 'PENDING_FEE') {
      filtered = filtered.filter((r: any) => Number(r.amount_paid || 0) < Number(r.fee_amount || 0));
    } else if (options.recipientFilter === 'SELECTED') {
      filtered = filtered.filter((r: any) => r.selection_status === 'SELECTED' || r.selection_status === 'CONFIRMED');
    }

    if (filtered.length === 0) {
      throw new AppError('No athletes matched the recipient filter', 400);
    }

    const tourName = tournament.name || tournament.title || 'Championship';
    const deadlineStr = tournament.registration_deadline ? new Date(tournament.registration_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBA';
    const dateStr = tournament.tournament_date ? new Date(tournament.tournament_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'TBA';

    const items = filtered
      .map((reg: any) => {
        const s = reg.students;
        const phone = s?.parent_whatsapp || s?.student_mobile;
        if (!phone) return null;

        const due = Math.max(0, Number(reg.fee_amount || 0) - Number(reg.amount_paid || 0));
        let body = '';
        if (options.customMessage && options.customMessage.trim()) {
          body = options.customMessage
            .replace(/\{student_name\}/gi, s.name)
            .replace(/\{tournament_name\}/gi, tourName)
            .replace(/\{deadline\}/gi, deadlineStr)
            .replace(/\{due_amount\}/gi, `₹${due.toLocaleString('en-IN')}`)
            .replace(/\{venue\}/gi, tournament.venue);
        } else if (options.recipientFilter === 'PENDING_FEE') {
          body = `⚠️ *Tournament Fee Deadline Reminder - Gurukul Sports Academy*\n\nDear *${s.name}* / Parents,\n\nThis is a reminder that your entry fee for *${tourName}* has a pending balance of *₹${due.toLocaleString('en-IN')}*.\n\n• *Deadline to Settle:* ${deadlineStr}\n• *Event Date:* ${dateStr}\n• *Venue:* ${tournament.venue}\n\nPlease clear the registration fee at the dojo desk or online before the deadline to confirm your spot.\n\nWarm regards,\n*Gurukul Sports & Martial Arts Academy*`;
        } else {
          body = `🏆 *Tournament Notice - Gurukul Sports Academy*\n\nDear *${s.name}* / Parents,\n\nOfficial notice regarding *${tourName}*:\n• *Date:* ${dateStr}\n• *Venue:* ${tournament.venue}\n• *Registration Fee:* ₹${Number(reg.fee_amount || 0).toLocaleString('en-IN')}\n• *Pending Dues:* ₹${due.toLocaleString('en-IN')}\n• *Registration Deadline:* ${deadlineStr}\n\nKindly prepare your sports kit and ensure regular attendance.\n\nWarm regards,\n*Gurukul Sports & Martial Arts Academy*`;
        }

        return {
          recipientPhone: phone,
          messageBody: body,
          studentId: s.id,
          eventType: 'TOURNAMENT_BROADCAST',
          idempotencyKey: `TOURN_BROADCAST:${tournamentId}:${s.id}:${Date.now()}`,
        };
      })
      .filter(Boolean) as any[];

    const queuedItems = await queueService.enqueueBatchStaggered(items, 16000, Date.now());

    // Update whatsapp_notified flag on registrations
    const regIds = filtered.map((r: any) => r.id);
    if (regIds.length > 0) {
      await supabaseAdmin
        .from('tournament_registrations')
        .update({ whatsapp_notified: true, updated_at: new Date().toISOString() })
        .in('id', regIds);
    }

    return {
      success: true,
      message: `Tournament alert successfully queued for ${queuedItems.length} athlete(s) with safe anti-ban spacing.`,
      sentCount: queuedItems.length,
    };
  }

  /**
   * Remove student nomination from tournament
   */
  static async removeRegistration(registrationId: string) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    const { error } = await supabaseAdmin
      .from('tournament_registrations')
      .delete()
      .eq('id', registrationId);

    if (error) throw new AppError(`Failed to remove registration: ${error.message}`, 500);

    return { success: true };
  }
}

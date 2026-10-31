import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';
import { queueService } from './whatsapp/queue.service.js';
import { memoryCache } from '../utils/cache.js';

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
  customMessage?: string;
  template?: string;
}

export class TournamentService {
  static readonly DEFAULT_NOMINATION_TEMPLATE = `🏆 *Tournament Selection Notice - Gurukul Sports Academy*

Congratulations! *{student_name}* has been officially selected to represent our academy in:

• *Tournament:* {tournament_name}
• *Discipline:* {discipline}
• *Date:* {event_date}
• *Venue:* {venue}
• *Entry Fee:* {entry_fee}
• *Fee Deadline:* {deadline}

Kindly confirm your entry with the academy coach.

Warm regards,
*Gurukul Sports & Martial Arts Academy*`;

  /**
   * Replaces dynamic tokens in tournament templates with athlete and tournament data.
   */
  static formatTournamentMessage(
    templateStr: string,
    data: {
      studentName: string;
      tournamentName: string;
      discipline: string;
      venue: string;
      eventDate: string;
      entryFee: number | string;
      dueAmount?: number | string;
      deadline: string;
      requiredDocuments?: string;
    }
  ): string {
    const feeStr = typeof data.entryFee === 'number' ? `₹${data.entryFee.toLocaleString('en-IN')}` : data.entryFee;
    const dueStr = data.dueAmount !== undefined
      ? (typeof data.dueAmount === 'number' ? `₹${data.dueAmount.toLocaleString('en-IN')}` : data.dueAmount)
      : feeStr;

    return templateStr
      .replace(/\{student_name\}|\{studentName\}|\{athlete_name\}|\{athleteName\}/gi, data.studentName)
      .replace(/\{tournament_name\}|\{tournamentName\}|\{championship_name\}|\{tournament_title\}/gi, data.tournamentName)
      .replace(/\{discipline\}|\{sport\}|\{art\}/gi, data.discipline)
      .replace(/\{venue\}|\{location\}|\{place\}/gi, data.venue)
      .replace(/\{event_date\}|\{tournament_date\}|\{date\}/gi, data.eventDate)
      .replace(/\{entry_fee\}|\{fee\}|\{fee_amount\}/gi, feeStr)
      .replace(/\{due_amount\}|\{due\}|\{pending_fee\}/gi, dueStr)
      .replace(/\{deadline\}|\{fee_deadline\}|\{registration_deadline\}/gi, data.deadline)
      .replace(/\{required_documents\}|\{documents\}|\{docs\}/gi, data.requiredDocuments || 'Aadhar Card, Age/Birth Certificate, Medical Fitness Clearance');
  }
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
      const endDate = t.description?.match(/END_DATE:([^\s]+)/)?.[1] || t.registration_deadline || t.tournament_date || '';
      return {
        ...t,
        title: t.title || t.name || 'Untitled Tournament',
        name: t.name || t.title || 'Untitled Tournament',
        discipline_code: t.discipline_code || t.discipline || 'KALARIPPAYATTU',
        venue: t.venue || 'Gurukul Sports Ground',
        start_date: t.start_date || t.tournament_date || '',
        end_date: endDate,
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
    const startDate = dto.startDate || dto.start_date || dto.tournamentDate || dto.tournament_date;
    const endDate = dto.endDate || dto.end_date || startDate;
    const discipline = dto.discipline || dto.discipline_code || 'General Sports';
    const organizer = dto.organizer || 'Gurukul Sports Federation';
    const entryFee = dto.entryFee !== undefined ? Number(dto.entryFee) : (dto.entry_fee !== undefined ? Number(dto.entry_fee) : 0);
    const status = dto.status || 'UPCOMING';
    const description = endDate ? `END_DATE:${endDate}` : '';

    if (!name || !venue || !startDate) {
      throw new AppError('Tournament name, venue, and start date are required', 400);
    }

    const { data, error } = await supabaseAdmin
      .from('tournaments')
      .insert({
        name,
        discipline,
        organizer,
        venue,
        tournament_date: startDate,
        registration_deadline: endDate,
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
      end_date: endDate,
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

    const endDate = tournament.description?.match(/END_DATE:([^\s]+)/)?.[1] || tournament.registration_deadline || tournament.tournament_date || '';
    const mappedTournament = {
      ...tournament,
      title: tournament.name || tournament.title || 'Untitled Tournament',
      name: tournament.name || tournament.title || 'Untitled Tournament',
      discipline_code: tournament.discipline_code || tournament.discipline || 'KALARIPPAYATTU',
      start_date: tournament.start_date || tournament.tournament_date || '',
      end_date: endDate,
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
   * Nominate / Select multiple students for a tournament (WhatsApp messaging disabled per client instructions)
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
    const fee = rawFee !== undefined ? Number(rawFee) : Number(tournament.entry_fee || 0);

    const rows = studentIds.map((studentId) => ({
      tournament_id: tournamentId,
      student_id: studentId,
      category: dto.category || 'General Division',
      fee_amount: fee,
      amount_paid: 0.00,
      payment_status: 'PENDING',
      selection_status: 'SELECTED',
      whatsapp_notified: false,
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
   * Send WhatsApp notification to an individual registered athlete (Disabled per client mandate)
   */
  static async notifyRegistration(registrationId: string, customMessage?: string) {
    return { success: true, message: 'Tournament WhatsApp messaging is disabled per academy request.' };
  }

  /**
   * Broadcast WhatsApp message to tournament athletes (Disabled per client mandate)
   */
  static async broadcastTournamentWhatsApp(
    tournamentId: string,
    options: any
  ) {
    return {
      success: true,
      message: 'Tournament WhatsApp messaging is disabled per academy request.',
      sentCount: 0,
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

    memoryCache.invalidateTag('dashboard');
    return { success: true };
  }

  /**
   * Update tournament details
   */
  static async updateTournament(tournamentId: string, updates: any) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    const payload: any = {
      updated_at: new Date().toISOString(),
    };
    if (updates.title || updates.name) payload.name = updates.title || updates.name;
    if (updates.venue !== undefined) payload.venue = updates.venue;
    const startDate = updates.start_date || updates.startDate || updates.tournament_date;
    if (startDate) payload.tournament_date = startDate;
    const endDate = updates.end_date || updates.endDate;
    if (endDate) {
      payload.registration_deadline = endDate;
      payload.description = `END_DATE:${endDate}`;
    }
    if (updates.status !== undefined) payload.status = updates.status;

    const { data, error } = await supabaseAdmin
      .from('tournaments')
      .update(payload)
      .eq('id', tournamentId)
      .select()
      .single();

    if (error) throw new AppError(`Failed to update tournament: ${error.message}`, 500);

    const resolvedEndDate = data.description?.match(/END_DATE:([^\s]+)/)?.[1] || data.registration_deadline || data.tournament_date;

    return {
      ...data,
      title: data.name,
      discipline_code: data.discipline,
      start_date: data.tournament_date,
      end_date: resolvedEndDate,
    };
  }

  static async deleteTournament(tournamentId: string) {
    if (!supabaseAdmin) throw new AppError('Database connection unavailable', 500);

    await supabaseAdmin
      .from('tournament_registrations')
      .delete()
      .eq('tournament_id', tournamentId);

    const { error } = await supabaseAdmin
      .from('tournaments')
      .delete()
      .eq('id', tournamentId);

    if (error) throw new AppError(`Failed to delete tournament: ${error.message}`, 500);

    memoryCache.invalidateTag('dashboard');
    return { success: true };
  }
}
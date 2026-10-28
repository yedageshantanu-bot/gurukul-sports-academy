import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

export class TeamMessageController {
  async listTeamMessages(_req: Request, res: Response, next: NextFunction) {
    try {
      const { data, error } = await supabaseAdmin
        .from('team_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.status(200).json({
        success: true,
        data: data || [],
      });
    } catch (err) {
      next(err);
    }
  }

  async createTeamMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        senderName,
        senderPosition,
        recipientRole,
        subject,
        message,
        priority,
      } = req.body;

      if (!message || !message.trim()) {
        res.status(400).json({ success: false, message: 'Message content is required.' });
        return;
      }

      const { data, error } = await supabaseAdmin
        .from('team_messages')
        .insert({
          sender_name: senderName ? senderName.trim() : null,
          sender_position: senderPosition ? senderPosition.trim() : null,
          recipient_role: recipientRole || 'ALL_STAFF',
          subject: subject ? subject.trim() : null,
          message: message.trim(),
          priority: priority || 'NORMAL',
          status: 'SENT',
        })
        .select('*')
        .single();

      if (error) throw error;

      res.status(201).json({
        success: true,
        message: 'Team message dispatched and stored successfully',
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteTeamMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { error } = await supabaseAdmin
        .from('team_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;

      res.status(200).json({
        success: true,
        message: 'Team message removed successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // TEAMS (GROUPS / CATEGORIES)
  // ==========================================

  async listTeams(_req: Request, res: Response, next: NextFunction) {
    try {
      const { data, error } = await supabaseAdmin
        .from('teams')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      res.status(200).json({
        success: true,
        data: data || [],
      });
    } catch (err) {
      next(err);
    }
  }

  async createTeam(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, code, marathiName, description, color } = req.body;

      if (!name || !name.trim()) {
        res.status(400).json({ success: false, message: 'Team name is required.' });
        return;
      }

      const generatedCode = (code && code.trim())
        ? code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')
        : name.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').substring(0, 30);

      const { data, error } = await supabaseAdmin
        .from('teams')
        .insert({
          name: name.trim(),
          code: generatedCode,
          marathi_name: marathiName ? marathiName.trim() : null,
          description: description ? description.trim() : null,
          color: color || 'indigo',
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          res.status(400).json({ success: false, message: `Team with code "${generatedCode}" already exists.` });
          return;
        }
        throw error;
      }

      res.status(201).json({
        success: true,
        message: 'New team created successfully',
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteTeam(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { error } = await supabaseAdmin
        .from('teams')
        .delete()
        .eq('id', id);

      if (error) throw error;

      res.status(200).json({
        success: true,
        message: 'Team removed successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // TEAM MEMBERS
  // ==========================================

  async listTeamMembers(req: Request, res: Response, next: NextFunction) {
    try {
      let query = supabaseAdmin
        .from('team_members')
        .select('*')
        .order('created_at', { ascending: false });

      const teamCode = req.query.teamCode as string;
      if (teamCode && teamCode !== 'ALL') {
        query = query.eq('team_code', teamCode);
      }

      const { data, error } = await query;
      if (error) throw error;

      res.status(200).json({
        success: true,
        data: data || [],
      });
    } catch (err) {
      next(err);
    }
  }

  async createTeamMember(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, phone, position, teamCode, district, notes } = req.body;

      if (!phone || !phone.trim()) {
        res.status(400).json({ success: false, message: 'Phone/WhatsApp number is required.' });
        return;
      }

      if (!teamCode || !teamCode.trim()) {
        res.status(400).json({ success: false, message: 'Team code is required.' });
        return;
      }

      const { data, error } = await supabaseAdmin
        .from('team_members')
        .insert({
          name: name ? name.trim() : null,
          phone: phone.trim(),
          position: position ? position.trim() : null,
          team_code: teamCode.trim(),
          district: district ? district.trim() : null,
          notes: notes ? notes.trim() : null,
          status: 'ACTIVE',
        })
        .select('*')
        .single();

      if (error) throw error;

      res.status(201).json({
        success: true,
        message: 'Team member added successfully',
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteTeamMember(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { error } = await supabaseAdmin
        .from('team_members')
        .delete()
        .eq('id', id);

      if (error) throw error;

      res.status(200).json({
        success: true,
        message: 'Team member removed successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const teamMessageController = new TeamMessageController();

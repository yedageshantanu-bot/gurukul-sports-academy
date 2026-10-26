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
}

export const teamMessageController = new TeamMessageController();

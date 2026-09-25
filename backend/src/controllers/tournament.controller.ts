import { Request, Response, NextFunction } from 'express';
import { TournamentService } from '../services/tournament.service.js';

export class TournamentController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await TournamentService.listTournaments();
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const tournament = await TournamentService.createTournament(req.body);
      res.status(201).json({ success: true, message: 'Tournament created successfully', data: tournament });
    } catch (err) {
      next(err);
    }
  }

  static async getDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await TournamentService.getTournamentDetails(req.params.id);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async nominate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await TournamentService.nominateStudents(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: `${result.nominatedCount} students nominated successfully with WhatsApp notification dispatched!`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async settle(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await TournamentService.settleRegistrationFee(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Tournament registration fee settled successfully',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await TournamentService.removeRegistration(req.params.id);
      res.status(200).json({ success: true, message: 'Student removed from tournament roster' });
    } catch (err) {
      next(err);
    }
  }
}

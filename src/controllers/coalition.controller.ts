import { NextFunction, Request, Response } from 'express';
import coalitionModel from '@/models/coalitions.model';

class CoalitionController {
  public Coalition = coalitionModel;

  public getCoallitions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const coalitions = await this.Coalition.find();
      res.status(201).json({ success: true, data: coalitions });
    } catch (error) {
      next(error);
    }
  };
  public getCoalitionByName = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const name = req.params.name;
      const coalition = await this.Coalition.findOne({ name: name });
      if (!coalition) {
        res.status(201).json({ success: false, error: 'Invalid Coalition name' });
      } else {
        res.status(201).json({ success: true, data: coalition });
      }
    } catch (err) {
      next(err);
    }
  };
  public addPointToGivenCoalition = async (req: Request, res: Response) => {
    try {
      const coalition_name = req.body.coalition_name;
      const points = parseInt(req.body.points);
      const coalition = await this.Coalition.findOne({ name: coalition_name });
      coalition.points += points;
      await coalition.save();
      res.status(201).json({ success: true, data: 'points added Scuccessfully' });
    } catch (err) {
      res.status(201).json({ success: false, error: 'Invalid Data' });
    }
  };
}

export default CoalitionController;

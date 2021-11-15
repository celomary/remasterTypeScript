import { NextFunction, Request, Response } from 'express';
import { Student } from '@interfaces/students.interface';
import scanedStudentModel from '@/models/scaned-students.model';
import studentModel from '@/models/students.model';
import flagModel from '@/models/flags.model';
import coalitionModel from '@/models/coalitions.model';
import { Types } from 'mongoose';
import teamModel from '@/models/teams.model';
import scanedFlagModel from '@/models/scanedFlag.model';

class StudentsController {
  public Student = studentModel;
  public scanedStudent = scanedStudentModel;
  public Flag = flagModel;
  public Coalition = coalitionModel;
  public Team = teamModel;
  public scanedFlags = scanedFlagModel;
  public getCurrentStudent = (req: Request, res: Response) => {
    res.status(200).json((req as any).user);
  };

  public getStudents = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const findAllStudentsData: Student[] = await this.Student.find().sort({ points: -1, connections: -1 });
      res.status(200).json({ success: true, data: findAllStudentsData });
    } catch (error) {
      next(error);
    }
  };

  public getStudentByIntraId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentIntraId: number = parseInt(req.params.intra_id);
      const findOneStudentData: Student = await this.Student.findOne({
        intra_id: studentIntraId,
      });

      res.status(200).json({ success: true, data: findOneStudentData });
    } catch (error) {
      next(error);
    }
  };

  public getStudentById = async (req: Request, res: Response) => {
    try {
      const _id = req.body.id;
      const student = await this.Student.findById(_id);
      if (!student) res.status(200).json({ success: false, error: 'Invalid Data' });
      else res.status(200).json({ success: true, data: student });
    } catch (error) {
      res.status(200).json({ success: false, error: 'Invalid Data' });
    }
  };

  public getStudentPasswordByIntraId = async (req: Request, res: Response) => {
    try {
      const intra_id = parseInt(req.params.intra_id);
      const student = await this.Student.findOne({ intra_id: intra_id });
      if (!student) {
        res.status(201).json({ error: 'Invalid data' });
      } else res.status(200).render('password.ejs', { password: student.pass });
    } catch {
      res.status(201).json({ error: 'Invalid data' });
    }
  };
  public getStudentByIds = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentIds: string[] = req.body.ids;
      const findStudentsData: Student[] = await this.Student.find({
        id: { $in: studentIds.map(id => Types.ObjectId(id)) },
      });

      res.status(200).json({ success: true, data: findStudentsData });
    } catch (error) {
      next(error);
    }
  };
  public getStudentByPassword = async (req: Request, res: Response) => {
    try {
      const password = req.body.password;
      const student = await this.Student.findOne({ pass: password });
      if (!student) res.status(201).json({ success: false, error: 'Invalid Password' });
      else {
        res.status(201).json({ success: true, data: student });
      }
    } catch {
      res.status(201).json({ success: false, error: 'Invalid Password' });
    }
  };
  public ScanQrCode = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const studentScan = req.body.user_id;
      const value = req.body.value;
      if (!studentScan || !value) {
        res.status(201).json({ suceess: false, data: 'Invalid data' });
        return;
      }
      const getfirstStudent = await this.Student.findById(studentScan);

      const hunts = await this.Flag.findById(value);
      if (!getfirstStudent) {
        res.status(201).json({ suceess: false, data: 'Invalid data' });
        return;
      }
      if (hunts) {
        if (hunts.priority !== getfirstStudent.flag_priority) {
          res.status(201).json({ success: false, error: 'Go to other qr code!' });
          return;
        }
        if (!hunts.scaned) {
          if (hunts.last) {
            const coalition = await this.Coalition.findById(getfirstStudent.coalition);
            const team = await this.Team.findById(getfirstStudent.coalition).populate('students');
            for (const student of team.students) {
              const flag = await this.scanedFlags.findOne({ student: student });
              flag.flags.push(hunts);
              await flag.save();
            }
            coalition.points += hunts.points;
            await coalition.save();
            hunts.scaned = true;

            // TODO: Send a message to all participants indicating that a team
            //       has found a flag and scored a point
          }
          getfirstStudent.flag_priority++;
          await getfirstStudent.save();
          res.status(201).json({ success: true, scaned: 'flag', data: { student: getfirstStudent, flag: hunts } });
        } else {
          res.status(201).json({ success: false, error: 'flag already scaned' });
        }
        return;
      }
      let found = false;
      const getSecondStudent = await this.Student.findOne({ _id: value });
      const getfirstScanedStudents = await this.scanedStudent.findOne({ student: getfirstStudent }).populate('scanedStudents');
      const getsecondScanedStudents = await this.scanedStudent.findOne({ student: getSecondStudent }).populate('scanedStudents');
      if (!getSecondStudent) {
        res.status(201).json({ success: false, error: 'Invalid Data' });
        return;
      }
      const popluateStudents = getfirstScanedStudents.scanedStudents;
      for (const student of popluateStudents) {
        if (student.login === getSecondStudent.login) {
          found = true;
          break;
        }
      }
      if (!found) {
        const popluateStudents = getsecondScanedStudents.scanedStudents;
        for (const student of popluateStudents) {
          if (student.login === getSecondStudent.login) {
            found = true;
            break;
          }
        }
      }
      if (!found) {
        const coalitionA = await this.Coalition.findById(getfirstStudent.coalition);
        const coalitionB = await this.Coalition.findById(getSecondStudent.coalition);
        coalitionA.points++;
        coalitionB.points++;
        getfirstStudent.connections++;
        getSecondStudent.connections++;
        getfirstScanedStudents.scanedStudents.push(getSecondStudent);
        getsecondScanedStudents.scanedStudents.push(getfirstStudent);
        await getfirstScanedStudents.save();
        await getsecondScanedStudents.save();
        await getfirstStudent.save();
        await getSecondStudent.save();
        await coalitionA.save();
        await coalitionB.save();

        // TODO: send a message to specific user with the updated connection count
        res.status(201).json({ success: true, scaned: 'student', data: { student: getfirstStudent } });
      } else {
        res.status(201).json({ success: false, error: 'Student Already Scaned' });
      }
    } catch (err) {
      next(err);
    }
  };
  public StudentScanedFlag = async (req: Request, res: Response) => {
    try {
      const student_id = req.body.student_id;
      const student = await this.Student.findById(student_id);
      const flags = await (await this.scanedFlags.findOne({ student: student })).populate('flags');
      if (flags.lastId < student.flag_priority && flags.flags[flags.lastId].priority === student.flag_priority) {
        const flag = flags.flags[flags.lastId];
        res.status(200).json({ sucess: true, flag: flag });
        flags.lastId++;
        flags.save();
        return;
      } else res.status(201).json({ success: false, flag: null });
    } catch (err) {
      res.status(201).json({ success: false, error: 'Scaned Error' });
    }
  };
}

export default StudentsController;

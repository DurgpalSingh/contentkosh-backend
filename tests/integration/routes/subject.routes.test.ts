import request from 'supertest';
import express from 'express';
import examRoutes from '../../../src/routes/exam.routes';
import * as SubjectRepo from '../../../src/repositories/subject.repo';
import * as CourseRepo from '../../../src/repositories/course.repo';
import * as ExamRepo from '../../../src/repositories/exam.repo';
import { errorHandler } from '../../../src/middlewares/error.middleware';
import logger from '../../../src/utils/logger';

// Mock dependencies
jest.mock('../../../src/repositories/subject.repo');
jest.mock('../../../src/repositories/course.repo');
jest.mock('../../../src/repositories/exam.repo');
jest.mock('../../../src/repositories/business.repo');
jest.mock('../../../src/middlewares/auth.middleware', () => ({
    authorize: () => (req: any, res: any, next: any) => next(),
}));
jest.mock('../../../src/utils/logger');

const app = express();
app.use(express.json());
app.use('/api/exams', examRoutes);
app.use(errorHandler);

describe('Subject Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/exams/:examId/courses/:courseId/subjects', () => {
        it('should create a subject', async () => {
            const subjectData = { name: 'Test Subject', description: 'Test description', courseId: 1 };
            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Course' });
            (SubjectRepo.createSubject as jest.Mock).mockResolvedValue({ id: 1, ...subjectData });

            const res = await request(app)
                .post('/api/exams/1/courses/1/subjects')
                .send(subjectData);

            expect(res.status).toBe(201);
            expect(res.body.data).toHaveProperty('id', 1);
            expect(res.body.data.name).toBe('Test Subject');
        });

        it('should return 400 if subject name is missing', async () => {
            const res = await request(app)
                .post('/api/exams/1/courses/1/subjects')
                .send({ description: 'Test description', courseId: 1 }); // Missing name

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Subject name is required');
        });

        it('should return 404 if course not found', async () => {
            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post('/api/exams/1/courses/999/subjects')
                .send({ name: 'Test Subject', courseId: 999 });

            expect(res.status).toBe(404);
            expect(res.body.message).toContain('Course not found');
        });
    });

    describe('GET /api/exams/:examId/courses/:courseId/subjects', () => {
        it('should return subjects for a course', async () => {
            const mockSubjects = [
                { id: 1, name: 'Subject 1', courseId: 1 },
                { id: 2, name: 'Subject 2', courseId: 1 }
            ];
            (SubjectRepo.findSubjectsByCourseId as jest.Mock).mockResolvedValue(mockSubjects);

            const res = await request(app).get('/api/exams/1/courses/1/subjects');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
        });

        it('should return 400 if courseId is invalid', async () => {
            const res = await request(app).get('/api/exams/1/courses/invalid/subjects');

            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/exams/:examId/courses/:courseId/subjects/:subjectId', () => {
        it('should return a subject by ID', async () => {
            const mockSubject = { id: 1, name: 'Test Subject', courseId: 1 };
            (SubjectRepo.findSubjectById as jest.Mock).mockResolvedValue(mockSubject);

            const res = await request(app).get('/api/exams/1/courses/1/subjects/1');

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(mockSubject);
        });

        it('should return 404 if subject not found', async () => {
            (SubjectRepo.findSubjectById as jest.Mock).mockResolvedValue(null);

            const res = await request(app).get('/api/exams/1/courses/1/subjects/999');

            expect(res.status).toBe(404);
        });

        it('should return 400 if subjectId is invalid', async () => {
            const res = await request(app).get('/api/exams/1/courses/1/subjects/invalid');

            expect(res.status).toBe(400);
        });
    });

    describe('PUT /api/exams/:examId/courses/:courseId/subjects/:subjectId', () => {
        it('should update a subject', async () => {
            const updatedSubject = { id: 1, name: 'Updated Subject', description: 'Updated description' };
            (SubjectRepo.updateSubject as jest.Mock).mockResolvedValue(updatedSubject);

            const res = await request(app)
                .put('/api/exams/1/courses/1/subjects/1')
                .send({ name: 'Updated Subject', description: 'Updated description' });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Updated Subject');
        });

        it('should return 400 if name is empty', async () => {
            const res = await request(app)
                .put('/api/exams/1/courses/1/subjects/1')
                .send({ name: '   ' }); // Empty name

            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /api/exams/:examId/courses/:courseId/subjects/:subjectId', () => {
        it('should delete a subject', async () => {
            (SubjectRepo.deleteSubject as jest.Mock).mockResolvedValue({ id: 1 });

            const res = await request(app).delete('/api/exams/1/courses/1/subjects/1');

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('Subject deleted successfully');
        });

        it('should return 400 if subjectId is invalid', async () => {
            const res = await request(app).delete('/api/exams/1/courses/1/subjects/invalid');

            expect(res.status).toBe(400);
        });
    });
});

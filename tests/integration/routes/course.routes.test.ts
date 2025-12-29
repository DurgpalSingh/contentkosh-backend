import request from 'supertest';
import express from 'express';
import examRoutes from '../../../src/routes/exam.routes';
import * as CourseRepo from '../../../src/repositories/course.repo';
import * as ExamRepo from '../../../src/repositories/exam.repo';
import { errorHandler } from '../../../src/middlewares/error.middleware';
import logger from '../../../src/utils/logger';

// Mock dependencies
jest.mock('../../../src/repositories/course.repo');
jest.mock('../../../src/repositories/exam.repo');
jest.mock('../../../src/repositories/business.repo');
jest.mock('../../../src/repositories/subject.repo');
jest.mock('../../../src/middlewares/auth.middleware', () => ({
    authorize: () => (req: any, res: any, next: any) => next(),
}));
jest.mock('../../../src/middlewares/validation.middleware', () => ({
    validateIdParam: () => (req: any, res: any, next: any) => next(),
    authorizeExamAccess: (req: any, res: any, next: any) => next(),
}));
jest.mock('../../../src/utils/logger');

const app = express();
app.use(express.json());
app.use('/api/exams', examRoutes);
app.use(errorHandler);

describe('Course Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/exams/:examId/courses', () => {
        it('should create a course', async () => {
            const courseData = { name: 'Test Course', description: 'Test description', examId: 1 };
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Exam' });
            (CourseRepo.createCourse as jest.Mock).mockResolvedValue({ id: 1, ...courseData });

            const res = await request(app)
                .post('/api/exams/1/courses')
                .send(courseData);

            expect(res.status).toBe(201);
            expect(res.body.data).toHaveProperty('id', 1);
            expect(res.body.data.name).toBe('Test Course');
        });

        it('should return 400 if course name is missing', async () => {
            const res = await request(app)
                .post('/api/exams/1/courses')
                .send({ description: 'Test description', examId: 1 }); // Missing name

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Course name is required');
        });

        it('should return 404 if exam not found', async () => {
            (ExamRepo.findExamById as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .post('/api/exams/999/courses')
                .send({ name: 'Test Course', examId: 999 });

            expect(res.status).toBe(404);
            expect(res.body.message).toContain('Exam not found');
        });
    });

    describe('GET /api/exams/:examId/courses', () => {
        it('should return courses for an exam', async () => {
            const mockCourses = [
                { id: 1, name: 'Course 1', examId: 1 },
                { id: 2, name: 'Course 2', examId: 1 }
            ];
            (CourseRepo.findCoursesByExamId as jest.Mock).mockResolvedValue(mockCourses);

            const res = await request(app).get('/api/exams/1/courses');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
        });

        it('should return 400 if examId is invalid', async () => {
            const res = await request(app).get('/api/exams/invalid/courses');

            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/exams/:examId/courses/:courseId', () => {
        it('should return a course by ID', async () => {
            const mockCourse = { id: 1, name: 'Test Course', examId: 1 };
            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue(mockCourse);

            const res = await request(app).get('/api/exams/1/courses/1');

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual(mockCourse);
        });

        it('should return 404 if course not found', async () => {
            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue(null);

            const res = await request(app).get('/api/exams/1/courses/999');

            expect(res.status).toBe(404);
        });

        it('should return 400 if courseId is invalid', async () => {
            const res = await request(app).get('/api/exams/1/courses/invalid');

            expect(res.status).toBe(400);
        });
    });



    describe('PUT /api/exams/:examId/courses/:courseId', () => {
        it('should update a course', async () => {
            const updatedCourse = { id: 1, name: 'Updated Course', description: 'Updated description' };
            (CourseRepo.updateCourse as jest.Mock).mockResolvedValue(updatedCourse);

            const res = await request(app)
                .put('/api/exams/1/courses/1')
                .send({ name: 'Updated Course', description: 'Updated description' });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Updated Course');
        });

        it('should return 400 if name is empty', async () => {
            const res = await request(app)
                .put('/api/exams/1/courses/1')
                .send({ name: '   ' }); // Empty name

            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /api/exams/:examId/courses/:courseId', () => {
        it('should delete a course', async () => {
            (CourseRepo.deleteCourse as jest.Mock).mockResolvedValue({ id: 1 });

            const res = await request(app).delete('/api/exams/1/courses/1');

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('Course deleted successfully');
        });

        it('should return 400 if courseId is invalid', async () => {
            const res = await request(app).delete('/api/exams/1/courses/invalid');

            expect(res.status).toBe(400);
        });
    });
});

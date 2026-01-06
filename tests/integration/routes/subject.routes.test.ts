import request from 'supertest';
import express from 'express';
import examRoutes from '../../../src/routes/exam.routes';
import * as SubjectRepo from '../../../src/repositories/subject.repo';
import * as CourseRepo from '../../../src/repositories/course.repo';
import * as ExamRepo from '../../../src/repositories/exam.repo';
import { errorHandler } from '../../../src/middlewares/error.middleware';
import { SubjectStatus } from '@prisma/client';

// Mock dependencies
jest.mock('../../../src/repositories/subject.repo');
jest.mock('../../../src/repositories/course.repo');
jest.mock('../../../src/repositories/exam.repo');
jest.mock('../../../src/middlewares/auth.middleware', () => ({
    authorize: () => (req: any, res: any, next: any) => next(),
}));
jest.mock('../../../src/middlewares/validation.middleware', () => ({
    validateIdParam: () => (req: any, res: any, next: any) => next(),
    validateDto: (dto: any) => (req: any, res: any, next: any) => next(), // Mocking DTO validation for now to focus on controller logic, or should we test it? 
    // Ideally we test that DTO validation middleware rejects invalid inputs. 
    // But since I used `validateDto` middleware, the bad request errors might come from there.
    // However, for this integration test, if I mock it to pass, I rely on controller logic.
    // But controller logic assumes valid DTO.
    // Let's NOT mock validateDto if we want to test validation.
    // CAUTION: validation.middleware uses `class-validator`.
    // If I mock it, I skip validation tests.
    // The previous test suite tested "return 400 if subject name is missing".
    // If I mock validateDto to pass, that test will fail (or I have to mock the controller to throw).
    // Let's unmock validation middleware if possible, OR keep it mocked and verify controller logic?
    // The previous `subject.routes.test.ts` had basic validation tests.
    // The new `exam.routes.ts` uses `validateDto`.
    // If I mock `validateDto` to just `next()`, then "name is missing" will be caught by DTO... wait, no.
    // If I mock it to pass, then empty name reaches controller/service.
    // Service doesn't check for empty name (it assumes DTO did).
    // So if I mock validateDto, I LOSE validation tests.
    // So I should removed the mock for validateDto? 
    // But `validateDto` is imported in `exam.routes.ts`.
    // The test file mocks `../../../src/middlewares/validation.middleware`.
    // I should probably PARTIALLY mock it or not mock it at all if I can.
    // But `authorizeExamAccess` needs mocking maybe?
    // Let's rely on the real `validateDto` but mock `authorize` and `authorizeExamAccess`.
    authorizeExamAccess: (req: any, res: any, next: any) => next(),
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
            const subjectData = { name: 'Test Subject', description: 'Test description', courseId: 1, status: SubjectStatus.ACTIVE };
            (CourseRepo.findCourseById as jest.Mock).mockResolvedValue({ id: 1, name: 'Test Course' });
            (SubjectRepo.createSubject as jest.Mock).mockResolvedValue({ id: 1, ...subjectData });

            const res = await request(app)
                .post('/api/exams/1/courses/1/subjects')
                .send(subjectData);

            expect(res.status).toBe(201);
            expect(res.body.data).toHaveProperty('id', 1);
            expect(res.body.data.name).toBe('Test Subject');
        });

        // Since I can't easily unmock validateDto here without unmocking the whole file (and I need authorizeExamAccess mocked), 
        // I will SKIP the validation failure test if I keep the validation mock.
        // BUT, wait. `validateDto` is in `dto.middleware.ts` (usually) or exported from `validation.middleware.ts`.
        // The mock above mocks `validation.middleware`.
        // In `exam.routes.ts`: `import { validateDto } from '../middlewares/validation/dto.middleware';` ?
        // Let's check imports in `exam.routes.ts`.
        // It imports `validateDto` from `../middlewares/validation/dto.middleware`.
        // BUT the test mocks `../../../src/middlewares/validation.middleware`.
        // So `validateDto` IS NOT MOCKED (unless `validation.middleware` re-exports it and route uses that).
        // `exam.routes.ts` line 7: `import { validateDto } from '../middlewares/validation/dto.middleware';`
        // So `validateDto` is REAL in this test.
        // So validation tests SHOULD work.

        it('should return 400 if subject name is missing (DTO Validation)', async () => {
            const res = await request(app)
                .post('/api/exams/1/courses/1/subjects')
                .send({ description: 'Test description', courseId: 1 }); // Missing name

            expect(res.status).toBe(400);
            expect(res.body.message).toBeDefined(); // DTO error message
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
                { id: 1, name: 'Subject 1', courseId: 1, status: SubjectStatus.ACTIVE },
                { id: 2, name: 'Subject 2', courseId: 1, status: SubjectStatus.INACTIVE }
            ];
            (SubjectRepo.findSubjectsByCourseId as jest.Mock).mockResolvedValue(mockSubjects);

            const res = await request(app).get('/api/exams/1/courses/1/subjects');

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
        });
    });

    describe('GET /api/exams/:examId/courses/:courseId/subjects/:subjectId', () => {
        it('should return a subject by ID', async () => {
            const mockSubject = { id: 1, name: 'Test Subject', courseId: 1, status: SubjectStatus.ACTIVE };
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
    });

    describe('PUT /api/exams/:examId/courses/:courseId/subjects/:subjectId', () => {
        it('should update a subject', async () => {
            const existingSubject = { id: 1, name: 'Old Name', courseId: 1, status: SubjectStatus.ACTIVE };
            const updatedSubject = { id: 1, name: 'Updated Subject', description: 'Updated description', status: SubjectStatus.ACTIVE };

            // Mock findSubjectById for Service existence check
            (SubjectRepo.findSubjectById as jest.Mock).mockResolvedValue(existingSubject);
            (SubjectRepo.updateSubject as jest.Mock).mockResolvedValue(updatedSubject);

            const res = await request(app)
                .put('/api/exams/1/courses/1/subjects/1')
                .send({ name: 'Updated Subject', description: 'Updated description' });

            expect(res.status).toBe(200);
            expect(res.body.data.name).toBe('Updated Subject');
        });

        it('should return 404 if subject to update not found', async () => {
            (SubjectRepo.findSubjectById as jest.Mock).mockResolvedValue(null);

            const res = await request(app)
                .put('/api/exams/1/courses/1/subjects/999')
                .send({ name: 'Updated Name' });

            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /api/exams/:examId/courses/:courseId/subjects/:subjectId', () => {
        it('should delete a subject', async () => {
            const existingSubject = { id: 1, name: 'To Delete', courseId: 1, status: SubjectStatus.ACTIVE };

            // Mock findSubjectById for Service existence check
            (SubjectRepo.findSubjectById as jest.Mock).mockResolvedValue(existingSubject);
            (SubjectRepo.deleteSubject as jest.Mock).mockResolvedValue({ id: 1 });

            const res = await request(app).delete('/api/exams/1/courses/1/subjects/1');

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('Subject deleted successfully');
        });

        it('should return 404 if subject to delete not found', async () => {
            (SubjectRepo.findSubjectById as jest.Mock).mockResolvedValue(null);

            const res = await request(app).delete('/api/exams/1/courses/1/subjects/999');

            expect(res.status).toBe(404);
        });
    });
});

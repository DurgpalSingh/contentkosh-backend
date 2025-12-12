# Changelog
All notable changes to this project will be documented in this file.

## Version [1.0.1] - login crash fix
**P.R raised by**  : aaditya-singh-21  
**Date** : 2025-12-04
### Fixed
- Fix login crash due to mismatched `id` naming between AuthService and user repository.

## Version [1.1.0] - Exam Management Module
**P.R raised by**  : aaditya-singh-21  
**Date** : 2025-12-08
### Added
- **Exam CRUD Endpoints**:
  - `POST /api/exams`: Create new exams (Admin only).
  - `GET /api/exams`: List exams by business ID.
  - `GET /api/exams/:id`: Get exam details.
  - `PUT /api/exams/:id`: Update exam details.
  - `DELETE /api/exams/:id`: Soft delete exams.
- **Validation**: Added 50-character limit for exam names.
- **Repository**: Updated `exam.repo.ts` with soft delete support.
- **Tests**: Added unit tests for exam controller.

## Version [1.2.0] - Batch-Course Relationship & Course Tests
**P.R raised by**  : aaditya-singh-21  
**Date** : 2025-12-11
### Fixed
- **Schema Update**: Fixed `Batch` model to link to `Course` instead of `Business`, aligning with the business model hierarchy: `Business → Exam → Course → Batch`.
- **Repository Update**: Updated `batch.repo.ts` to use `courseId` instead of `businessId`.
- **Controller Update**: Updated `batch.controller.ts` to validate against `Course` instead of `Business`.
- **Routes Update**: Changed batch endpoint from `/api/batches/business/:businessId` to `/api/batches/course/:courseId`.
- **Seed Data**: Updated `seed.ts` to create batches linked to courses.

### Added
- **Course Module Tests**:
  - Unit tests: `tests/unit/controllers/course.controller.test.ts` (13 tests)
  - Integration tests: `tests/integration/routes/course.routes.test.ts` (14 tests)
- **Test Coverage**: All 51 tests passing (22 exam + 29 course tests).

## Version [1.3.0] - Subject & Batch Module Tests
**P.R raised by**  : aaditya-singh-21  
**Date** : 2025-12-12
### Added
- **Subject Module Tests**:
  - Unit tests: `tests/unit/controllers/subject.controller.test.ts` (12 tests)
  - Integration tests: `tests/integration/routes/subject.routes.test.ts` (13 tests)
- **Batch Module Tests**:
  - Unit tests: `tests/unit/controllers/batch.controller.test.ts` (30 tests)
  - Integration tests: `tests/integration/routes/batch.routes.test.ts` (31 tests)
- **Test Coverage**: All 137 tests passing (8 test suites).


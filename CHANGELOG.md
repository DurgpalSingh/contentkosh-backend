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



# Changelog
All notable changes to this project will be documented in this file.

## Version [1.9.0] - Audit Logging & Bug Fixes
**P.R raised by**  : aaditya-singh-21
**Date** : 2026-02-04
### Added
- **API Audit Logging**: 
    - **Schema**: Added `ApiAuditLog` model to `schema.prisma`.
    - **Middleware**: Implemented `apiAuditLogger` to log all request/response details to the database asynchronously.
    - **Verification**: Added `src/scripts/verify-audit.ts` to verify logging functionality.

## Version [1.8.2] - Business Signup & Slug Support
**P.R raised by**  : aaditya-singh-21
**Date** : 2026-02-02
### Added
- **Business Signup**:
    - **Slug Support**: Added `slug` field to `Business` model to support URL-friendly identification (e.g., `contentkosh.in/vision-ias`).
    - **Create Business**: Enhanced `POST /api/business` to accept `slug`, `logo_url`, `phone`, and `email`.
    - **Get by Slug**: Added `GET /api/business/slug/:slug` endpoint.

### Refactored
- **Architecture**:
    - **Business Service**: Created `BusinessService` to decouple controller from repository.
    - **DTOs**: Implemented strict validation using `CreateBusinessDto` and `UpdateBusinessDto`.
    - **Controller**: Refactored `BusinessController` to use DTOs and Service layer.

## Version [1.1.9] - Teacher Management API
**P.R raised by**  : Shubh404-SE 
**Date** : 2026-01-30

### Added
- **Teacher Management API**: Introduced full lifecycle management for teacher profiles with strict authorization and validation.
  - **Create Teacher Profile**:
    - `POST /api/teachers/profile`
    - Admin-only creation with business ownership validation.
    - Supports professional and personal details with nested DTO validation.
  - **Get Teacher Profile**:
    - `GET /api/teachers/:teacherId`
    - Accessible to Admins and authorized business users.
  - **Update Teacher Profile**:
    - `PUT /api/teachers/:teacherId`
    - Supports partial updates for professional details, personal details, and status.

- **DTOs**:
  - Added `CreateTeacherDto` and `UpdateTeacherDto` with nested validation using `class-validator` and `class-transformer`.
  - Introduced structured sub-DTOs for `ProfessionalDetails` and `PersonalDetails`.

- **Service Layer**:
  - Implemented `TeacherService` with centralized business rules:
    - Cross-business access control
    - Duplicate teacher prevention
    - Experience validation
    - Ownership-based update permissions

- **Controller Layer**:
  - Added `TeacherController` with consistent response handling using `ApiResponseHandler`.
  - Standardized error mapping for `400`, `403`, and `404` scenarios.

- **Authorization & Validation**:
  - Integrated role-based access control (`ADMIN`, `SUPERADMIN`) and teacher-level authorization.
  - Added strict path param validation and DTO-based request validation.

### Tests
- **Controller Tests**:
  - Added comprehensive unit tests for Teacher controller covering success paths, authorization failures, validation errors, and edge cases.

## Version [1.8.1] - Support for Dynamic UI & Permissions
**P.R raised by**  : aaditya-singh-21
**Date** : 2026-01-24
### Changed
- **Profile API for Dynamic UI**: Enhanced `GET /api/users/profile` to return complete user profile data (including `role`, `name`, and `business` context). This enables the frontend to dynamically render the correct dashboard layout and sidebar items based on the user's identity.

### Fixed
- **Permission Repository**: Fixed `Invalid column` error in `role_permissions` query by removing references to non-existent `isDeleted` column.
- **Architecture Compliance**: Refactored `Auth Controller` to route database requests through `UserService`, ensuring properly layered architecture.

## Version [1.8.0] - Permission API & Role Management
**P.R raised by**  : aaditya-singh-21
**Date** : 2026-01-18
### Added
- **Permission System**:
    - **Models**: Added `Permission` and `RolePermission` tables to `schema.prisma`.
    - **Seeding**: Populated database with standard permissions (`CONTENT_*`, `ANNOUNCEMENT_*`).
    - **Repository**: Created `PermissionRepository` to abstract database operations.
    - **Service**: Implemented `PermissionService` with validation logic (User existence, Permission validity).
    - **Controller**: Implemented `PermissionController` with consistent error handling (`ApiError`).
- **API Endpoints**:
    - `GET /permission`: Fetch permissions for a user (by `user_id` query param).
    - `POST /permission`: Assign new permissions to a user.
    - `PUT /permission`: Replace all permissions for a user.
    - `DELETE /permission`: Remove all or specific permissions for a user.
- **Tests**:
    - **Integration**: Added comprehensive test suite `tests/integration/routes/permission.routes.test.ts` covering all CRUD operations (10 tests).

### Refactored
- **Architecture**: Enforced strict Controller -> Service -> Repository pattern for Permission module.
- **Error Handling**: Standardized usage of `ApiResponseHandler` and typed `ApiError` across the new module.
## Version [1.1.8] - Content Management API
**P.R raised by**  : Shubh404-SE  
**Date** : 2026-01-23

### Added
- **Content Management API**: Implemented full lifecycle management for batch-specific educational content (PDFs and Images).
  - **Create Content (Multipart Upload)**:
    - `POST /api/batches/:batchId/contents`
    - Secure file upload using `multer` with server-side derivation of:
      - `type` (PDF | IMAGE)
      - `filePath`
      - `fileSize`
    - Strict middleware pipeline enforcing authentication, role-based authorization (ADMIN, TEACHER), batch access validation, file validation, and DTO validation.
  - **List Batch Contents**:
    - `GET /api/batches/:batchId/contents`
  - **Get Content Metadata**:
    - `GET /api/contents/:contentId`
  - **Content File Streaming**:
    - `GET /api/contents/:contentId/file`
    - Streams stored files securely without exposing filesystem paths.
  - **Update Content**:
    - `PUT /api/contents/:contentId`
    - Supports metadata updates with proper authorization checks.
  - **Delete Content**:
    - `DELETE /api/contents/:contentId`
    - Cascade deletion handled via Prisma relations.

- **DTOs**:
  - Added `CreateContentDto` and `UpdateContentDto` with strict `class-validator` rules.
  - DTOs validate request body only; path parameters and derived fields are handled outside DTOs.

- **Schema**:
  - Added `Content` model with relations to `Batch` and `User`.
  - Introduced `ContentType` (PDF, IMAGE) and `ContentStatus` (ACTIVE, INACTIVE) enums.
  - Enabled cascade delete behavior.

### Refactored
- **Middleware Pipeline**:
  - Standardized multipart upload flow to ensure predictable preprocessing and validation order.
- **Service Layer**:
  - Enforced explicit service method contracts with no dependency on request or route parameters.
- **Authorization**:
  - Centralized batch-level access validation for all content operations.

### Tests
- **Integration**:
  - Added and verified end-to-end tests covering content creation, retrieval, file streaming, update, and deletion.

## Version [1.7.0] - User & Auth API
**P.R raised by**  : aaditya-singh-21
**Date** : 2026-01-14
### Added
- **Secure Refresh Token Rotation**: Implemented a robust token refresh mechanism to maintain user sessions securely without frequent re-logins.
    - **Endpoint**: `POST /auth/refresh`
    - **Mechanism**: Exchanges a valid (long-lived) refresh token for a new (short-lived) access token.
    - **Security**:
        - Refresh tokens are stored in the database (`RefreshToken` model) with strict expiration times.
        - Support for token revocation (e.g., on logout), limiting the risk of stolen tokens.
        - Prevents "forever" sessions if a user is banned or their access is revoked server-side.
- **Batch User Filtering**: Added ability to filter users within a batch by their role.
    - **Endpoint**: `GET /api/batches/:batchId/users?role=STUDENT`
    - **Use Case**: Allows fetching only Students or Teachers for a specific batch.
- **Swagger Documentation Updates**:
    - Updated `User` schema to include critical fields (`role`, `status`, `mobile`).
    - Standardized API documentation using shared schema references (`$ref`) for consistency.
- **Auth API**: New dedicated authentication routes under `/api/auth`:
    - `POST /auth/signup`: Public user registration (role defaults to USER).
    - `POST /auth/login`: User login with JWT token generation.
    - `POST /auth/logout`: Client-side logout acknowledgement.
    - `GET /auth/me`: Fetch logged-in user profile.
- **User Management API**: Admin-only user CRUD under `/api`:
    - `GET /business/:businessId/users`: List users for a business (with optional role filter).
    - `POST /business/:businessId/users`: Create user for a business.
    - `PUT /users/:userId`: Update user details (name, mobile, role, status).
    - `DELETE /users/:userId`: Soft delete user (sets status to INACTIVE).
- **DTOs**: Added `CreateUserDto`, `UpdateUserDto` with strict `class-validator` rules.
- **Schema**: Updated `User` model:
    - Added `businessId` (FK), `mobile`, `role`, `status`, `emailVerified`, `createdBy`, `updatedBy`.
    - Added `UserStatus` Enum (ACTIVE/INACTIVE).
    - Composite unique constraints on `[businessId, email]` and `[businessId, mobile]`.
- **Removed `BusinessUser` Model**: Simplified user-business relationship to 1:1.

### Refactored
- **Cross-Tenant Authorization**: Enhanced security on user management routes. Now enforces strict checks to ensure admins can only manage users within their own business/tenant.
- **Swagger Schemas**: Refactored `user.routes.ts` to use centralized schema definitions.
- **User Controller**: Refactored to use new schema fields and `UserRepository` methods.
- **Auth Service**: Consolidated `register`, `login`, and token generation logic.
- **Routes**: Separated auth routes from user management routes.
- **Authorization**: Implemented role-based authorization for user management.
- **Middleware**: Added `authMiddleware` to protect routes.

### Tests
- **Integration**: Added more integration tests for user management.

## Version [1.6.0] - Batch API & Test Coverage
**P.R raised by**  : aaditya-singh-21
**Date** : 2026-01-08
### Added
- **Batch API**: Implemented full CRUD operations for Batches linked to Courses.
- **Service Layer**: Introduced `BatchService` for business logic separation.
- **Swagger**: Updated `Exam` schemas to include missing fields (`code`, `startDate`, `endDate`).
- **DTOs**: Added `CreateBatchDto`, `UpdateBatchDto` with strict validation.

### Refactored
- **Standardization**: Unified Controller-Service-Repository architecture across Exam, Course, Subject, and Batch modules.
- **Error Handling**: Consistent use of `ApiResponseHandler` and custom error classes (404, 400).
- **Cleanup**: Removed legacy/redundant code and updated validation middlewares.

### Tests
- **Integration**: Expanded coverage for Filters (`?active=true`) and Error Handling (404/400) across all modules.

## Version [1.5.0] - Course & Subject API Refactoring
**P.R raised by**  : aaditya-singh-21
**Date** : 2026-01-06
### Added
- **Course Status**: Replaced `isActive` boolean with `CourseStatus` Enum (ACTIVE/INACTIVE) in Schema.
- **DTOs**:
    - Added `CreateCourseDto` and `UpdateCourseDto` with strict `class-validator` rules.
    - Added `CreateSubjectDto` and `UpdateSubjectDto` with strict `class-validator` rules.
- **Service Layer**:
    - Implemented `CourseService` to handle business logic and validation, separating it from the controller.
    - Implemented `SubjectService` to handle business logic for Subjects.
- **Mapper**: Added `CourseMapper` and `SubjectMapper` for domain model transformation.
- **Swagger**: Updated `Course`, `Exam`, and `Subject` schemas to reflect `status` Enum.

### Refactored
- **Course Controller**: Refactored to use `CourseService` and updated route handlers to use `validateDto` middleware.
- **Subject Controller**: Refactored to use `SubjectService` and updated route handlers for better error handling and validation.
- **Course Repository**: Updated to use strict typing (`Prisma.CourseUncheckedCreateInput`) and handle `status` enum.
- **Routes**: Removed stale Exam route documentation from `exam.routes.ts` and clarified migration to `business.routes.ts`.

### Tests
- **Integration Tests**: Updated `tests/integration/routes/course.routes.test.ts` to align with new schema (Status Enum) and strict validation rules.

## Version [1.4.0] - Exam API Implementation
**P.R raised by**  : aaditya-singh-21
**Date** : 2025-12-26
### Added
- **Exam Schema**: Updated `Exam` model with `code`, `status` (Enum), `startDate`, `endDate`, and audit fields.
- **Nested Routes**: Added `POST` and `GET` for `/api/business/:businessId/exams`.
- **Exam Status**: Replaced `isActive` boolean with `ExamStatus` Enum (ACTIVE/INACTIVE).

### Refactored
- **Exam Controller**: Implemented strict validation, proper DTO mapping, and business ownership checks.
- **Exam Repository**: Updated all methods to handle new schema fields and soft delete via status Enum.

## Version [1.3.2] - Dynamic API & Optimization
**P.R raised by**  : aaditya-singh-21  
**Date** : 2025-12-22
### Added
- **Dynamic API Support**: Implemented `QueryBuilder` utility to support sparse fieldsets (`?fields=`) and dynamic relation inclusion (`?include=`).
- **Optimization**: Updated `Course` and `Exam` endpoints to allow clients to fetch exactly what they need in a single request, reducing over-fetching and solving the N+1 problem.

### Refactored
- **Code Cleanup**: Removed redundant repository functions `findCourseWithSubjects` and `findExamWithCourses`.
- **Controller Updates**: Refactored `CourseController` and `ExamController` to use generic `findById` methods with explicit options.
- **Removed Deprecated**: Deleted `GET /api/exams/:id/with-courses` and `GET /api/exams/:examId/courses/:courseId/with-subjects` endpoints to clean up codebase.

### Tests
- **Test Updates**: Updated unit and integration tests to cover dynamic query logic and ensure no regressions from the refactor.
- **Enhanced Coverage**: Added specific unit tests for `fields` and `include` query parameters to verify `QueryBuilder` integration.

### Optimizations
- **Database Indexing**: Added foreign key indexes to `schema.prisma` for `Exam`, `Course`, `Subject`, `Batch`, and `Announcement` models to improve query performance.
- **Response Compression**: Enabled `compression` (Gzip/Brotli) middleware in the Express app to reduce API response payload sizes.
- **Advanced Sorting**: Implemented dynamic sorting support in `QueryBuilder` allowing clients to sort results via `?sort=field:asc` or `?sort=field:desc`.

## Version [1.3.1] - Subject & Batch Prisma Conflict Fix
**P.R raised by**  : aaditya-singh-21  
**Date** : 2025-12-20
### Fixed
- **Subject Controller**: Fixed Prisma conflict in `createSubject` where spreading `subjectData` (containing `courseId`) alongside `course: { connect: {...} }` caused a type conflict.
- **Batch Controller**: Fixed same Prisma conflict in `createBatch` where spreading `batchData` (containing `courseId`) alongside `course: { connect: {...} }` caused a type conflict.
- **Course Controller**: Fixed same Prisma conflict in `createCourse` where spreading `courseData` (containing `examId`) alongside `exam: { connect: {...} }` caused a type conflict.
- **Resolution**: Replaced spread operator with explicit property assignment using proper `Prisma.SubjectCreateInput`, `Prisma.BatchCreateInput`, and `Prisma.CourseCreateInput` formats.

### Added
- **Auth**: Admin tokens now have a lifelong expiration.
- **Course API**: `GET` endpoints now include `exam` (name) and `subjects` list.

### Refactored
- **Validation Logic**: Refactored repetitive validation checks in `batch`, `subject`, `course`, and `exam` controllers into a generic `ValidationUtils` class.
- **Utils**: Added `validateNonEmptyString` and `validateDateRange` helper functions to `src/utils/validation.ts`.
- **Standardization**: Unified error messages for required fields and date range validations across all modules.

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

## Version [1.0.1] - login crash fix
**P.R raised by**  : aaditya-singh-21  
**Date** : 2025-12-04
### Fixed
- Fix login crash due to mismatched `id` naming between AuthService and user repository.

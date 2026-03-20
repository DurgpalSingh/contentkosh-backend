/**
 * @swagger
 * /api/business/{businessId}/practice-tests:
 *   post:
 *     summary: Create Practice Test
 *     tags: [Practice Tests]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePracticeTestDTO'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "201":
 *         description: Practice test created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PracticeTest'
 *   get:
 *     summary: List Practice Tests
 *     tags: [Practice Tests]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - in: query
 *         name: status
 *         schema:
 *           $ref: '#/components/schemas/TestStatus'
 *       - in: query
 *         name: batchId
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: List of practice tests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PracticeTest'
 *
 * /api/business/{businessId}/practice-tests/{practiceTestId}:
 *   get:
 *     summary: Get Practice Test
 *     tags: [Practice Tests]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/practiceTestId'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: Practice test details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PracticeTest'
 *   put:
 *     summary: Update Practice Test
 *     tags: [Practice Tests]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/practiceTestId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePracticeTestDTO'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: Updated test
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PracticeTest'
 *   delete:
 *     summary: Delete Practice Test
 *     tags: [Practice Tests]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/practiceTestId'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "204":
 *         description: Deleted
 *
 * /api/business/{businessId}/practice-tests/publish:
 *   post:
 *     summary: Publish Practice Test
 *     tags: [Practice Tests]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PublishPracticeTestRequest'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         $ref: '#/components/responses/ApiResponse'
 *
 * /api/business/{businessId}/practice-tests/{practiceTestId}/questions:
 *   get:
 *     summary: List Practice Test Questions
 *     tags: [Questions]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/practiceTestId'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: List of questions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TestQuestion'
 *   post:
 *     summary: Add Question to Practice Test
 *     tags: [Questions]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/practiceTestId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateQuestionDTO'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "201":
 *         description: Question created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TestQuestion'
 *
 * /api/business/{businessId}/practice-tests/questions/{questionId}:
 *   put:
 *     summary: Update Practice Question
 *     tags: [Questions]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/questionId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateQuestionDTO'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: Question updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TestQuestion'
 *   delete:
 *     summary: Delete Practice Question
 *     tags: [Questions]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/questionId'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "204":
 *         description: Deleted
 *
 * /api/business/{businessId}/practice-tests/available:
 *   get:
 *     summary: List Available Practice Tests
 *     tags: [Practice Tests]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: Available tests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PracticeAvailableTest'
 *
 * /api/business/{businessId}/practice-tests/attempts:
 *   post:
 *     summary: Start Practice Test Attempt
 *     tags: [Attempts]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StartPracticeAttemptRequest'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "201":
 *         description: Attempt started
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StartPrecticeTestAttemptResponse'
 *
 * /api/business/{businessId}/practice-tests/attempts/{attemptId}/submit:
 *   post:
 *     summary: Submit Practice Attempt
 *     tags: [Attempts]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/attemptId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitAttemptRequest'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: Submission result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubmitAttemptResponse'
 *
 * /api/business/{businessId}/practice-tests/attempts/{attemptId}:
 *   get:
 *     summary: Get Attempt Details
 *     tags: [Attempts]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/attemptId'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: Attempt details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PracticeTestAttemptDetails'
 */
/**
 * @swagger
 * /api/business/{businessId}/practice-tests/{practiceTestId}/analytics:
 *   get:
 *     summary: Practice Test Analytics
 *     tags: [Analytics]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/practiceTestId'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: Analytics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TestAnalytics'
 *
 * /api/business/{businessId}/practice-tests/{practiceTestId}/analytics/export:
 *   get:
 *     summary: Export Analytics CSV
 *     tags: [Analytics]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/practiceTestId'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: CSV
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *
 * /api/business/{businessId}/exam-tests:
 *   post:
 *     summary: Create Exam Test
 *     tags: [Exam Tests]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateExamTestDTO'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "201":
 *         description: Exam test created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExamTest'
 *   get:
 *     summary: List Exam Tests
 *     tags: [Exam Tests]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - in: query
 *         name: status
 *         schema:
 *           $ref: '#/components/schemas/TestStatus'
 *       - in: query
 *         name: batchId
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: List exam tests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ExamTest'
 *
 * /api/business/{businessId}/exam-tests/{examTestId}:
 *   get:
 *     summary: Get Exam Test
 *     tags: [Exam Tests]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/examTestId'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: Exam test details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExamTest'
 *   put:
 *     summary: Update Exam Test
 *     tags: [Exam Tests]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/examTestId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateExamTestDTO'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: Updated test
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExamTest'
 *   delete:
 *     summary: Delete Exam Test
 *     tags: [Exam Tests]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/examTestId'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "204":
 *         description: Deleted
 */
/**
 * @swagger
 * /api/business/{businessId}/exam-tests/publish:
 *   post:
 *     summary: Publish Exam Test
 *     tags: [Exam Tests]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PublishExamTestRequest'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         $ref: '#/components/responses/ApiResponse'
 *
 * /api/business/{businessId}/exam-tests/{examTestId}/questions:
 *   get:
 *     summary: List Exam Test Questions
 *     tags: [Questions]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/examTestId'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: List of questions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TestQuestion'
 *   post:
 *     summary: Add Question to Exam Test
 *     tags: [Questions]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/examTestId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateQuestionDTO'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "201":
 *         description: Question created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TestQuestion'
 *
 * /api/business/{businessId}/exam-tests/questions/{questionId}:
 *   put:
 *     summary: Update Exam Question
 *     tags: [Questions]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/questionId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateQuestionDTO'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: Question updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TestQuestion'
 *   delete:
 *     summary: Delete Exam Question
 *     tags: [Questions]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/questionId'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "204":
 *         description: Deleted
 *
 * /api/business/{businessId}/exam-tests/available:
 *   get:
 *     summary: List Available Exam Tests
 *     tags: [Exam Tests]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: Available tests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ExamAvailableTest'
 *
 * /api/business/{businessId}/exam-tests/attempts:
 *   post:
 *     summary: Start Exam Test Attempt
 *     tags: [Attempts]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StartExamAttemptRequest'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "201":
 *         description: Attempt started
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StartExamTestAttemptResponse'
 *
 * /api/business/{businessId}/exam-tests/attempts/{attemptId}/submit:
 *   post:
 *     summary: Submit Exam Attempt
 *     tags: [Attempts]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/attemptId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitAttemptRequest'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: Submission result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubmitAttemptResponse'
 *
 * /api/business/{businessId}/exam-tests/attempts/{attemptId}:
 *   get:
 *     summary: Get Attempt Details
 *     tags: [Attempts]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/attemptId'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: Attempt details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ExamTestAttemptDetails'
 */
/**
 * @swagger
 * /api/business/{businessId}/exam-tests/{examTestId}/analytics:
 *   get:
 *     summary: Exam Test Analytics
 *     tags: [Analytics]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/examTestId'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: Analytics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TestAnalytics'
 *
 * /api/business/{businessId}/exam-tests/{examTestId}/analytics/export:
 *   get:
 *     summary: Export Analytics CSV
 *     tags: [Analytics]
 *     parameters:
 *       - $ref: '#/components/parameters/businessId'
 *       - $ref: '#/components/parameters/examTestId'
 *     responses:
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *       "409":
 *         $ref: '#/components/responses/Conflict'
 *       "422":
 *         $ref: '#/components/responses/UnprocessableEntity'
 *       "500":
 *         $ref: '#/components/responses/InternalServerError'
 *       "200":
 *         description: CSV
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 */

export {};

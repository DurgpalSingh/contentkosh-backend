export type PracticeTestResponse = {
  id: string;
  businessId: number;
  batchId: number;
  name: string;
  description?: string | null;
  status: number;
  defaultMarksPerQuestion: number;
  showExplanations: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  createdBy: number;
  updatedBy?: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ExamTestResponse = {
  id: string;
  businessId: number;
  batchId: number;
  name: string;
  description?: string | null;
  status: number;
  startAt: Date;
  deadlineAt: Date;
  durationMinutes: number;
  defaultMarksPerQuestion: number;
  negativeMarksPerQuestion: number;
  resultVisibility: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  createdBy: number;
  updatedBy?: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TestOptionResponse = {
  id: string;
  text: string;
  mediaUrl?: string | null;
};

export type TestQuestionResponse = {
  id: string;
  practiceTestId?: string | null;
  examTestId?: string | null;
  type: number;
  questionText: string;
  mediaUrl?: string | null;
  explanation?: string | null;
  correctTextAnswer?: string | null;
  correctOptionIdsAnswers: string[];
  options: TestOptionResponse[];
};

export const TestMapper = {
  practiceTest(t: any): PracticeTestResponse {
    return {
      id: t.id,
      businessId: t.businessId,
      batchId: t.batchId,
      name: t.name,
      description: t.description ?? null,
      status: t.status,
      defaultMarksPerQuestion: t.defaultMarksPerQuestion,
      showExplanations: t.showExplanations,
      shuffleQuestions: t.shuffleQuestions,
      shuffleOptions: t.shuffleOptions,
      createdBy: t.createdBy,
      updatedBy: t.updatedBy ?? null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  },

  examTest(t: any): ExamTestResponse {
    return {
      id: t.id,
      businessId: t.businessId,
      batchId: t.batchId,
      name: t.name,
      description: t.description ?? null,
      status: t.status,
      startAt: t.startAt,
      deadlineAt: t.deadlineAt,
      durationMinutes: t.durationMinutes,
      defaultMarksPerQuestion: t.defaultMarksPerQuestion,
      negativeMarksPerQuestion: t.negativeMarksPerQuestion,
      resultVisibility: t.resultVisibility,
      shuffleQuestions: t.shuffleQuestions,
      shuffleOptions: t.shuffleOptions,
      createdBy: t.createdBy,
      updatedBy: t.updatedBy ?? null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  },

  question(q: any): TestQuestionResponse {
    return {
      id: q.id,
      practiceTestId: q.practiceTestId ?? null,
      examTestId: q.examTestId ?? null,
      type: q.type,
      questionText: q.text,
      mediaUrl: q.mediaUrl ?? null,
      explanation: q.explanation ?? null,
      correctTextAnswer: q.correctTextAnswer ?? null,
      correctOptionIdsAnswers: q.correctOptionIdsAnswers ?? [],
      options: (q.options ?? []).map((o: any) => ({
        id: o.id,
        text: o.text,
        mediaUrl: o.mediaUrl ?? null,
      })),
    };
  },
};


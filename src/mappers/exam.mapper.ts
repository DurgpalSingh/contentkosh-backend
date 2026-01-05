import { Exam } from '@prisma/client';

export class ExamMapper {
    static toDomain(data: any): Exam {
        return data as Exam;
    }
}

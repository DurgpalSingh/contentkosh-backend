import { Subject } from '@prisma/client';

export class SubjectMapper {
    static toDomain(subject: Subject): Subject {
        return {
            id: subject.id,
            name: subject.name,
            description: subject.description,
            status: subject.status,
            courseId: subject.courseId,
            createdAt: subject.createdAt,
            updatedAt: subject.updatedAt,
        };
    }
}

import { Course } from '@prisma/client';

export class CourseMapper {
    static toDomain(data: any): Course {
        return data as Course;
    }
}

import { UserRole } from '@prisma/client';

// Response types for type safety
export interface AdminDashboardStats {
    totalUsers: number;
    totalTeachers: number;
    totalStudents: number;
    totalExams: number;
    totalCourses: number;
    totalBatches: number;
    totalContent: number;
    activeAnnouncements: number;
}

export interface TeacherDashboardStats {
    totalBatches: number;
    totalStudents: number;
    totalContent: number;
    activeAnnouncements: number;
}

export interface StudentDashboardStats {
    enrolledBatches: number;
    totalContent: number;
    activeAnnouncements: number;
}

export interface AdminDashboardResponse {
    stats: AdminDashboardStats;
    recentUsers: Array<{
        id: number;
        name: string;
        email: string;
        role: UserRole;
        createdAt: Date;
    }>;
    recentAnnouncements: Array<{
        id: number;
        heading: string;
        startDate: Date;
        endDate: Date;
    }>;
}

export interface TeacherDashboardResponse {
    stats: TeacherDashboardStats;
    myBatches: Array<{
        id: number;
        displayName: string;
        courseName: string;
        studentCount: number;
        isActive: boolean;
    }>;
    recentAnnouncements: Array<{
        id: number;
        heading: string;
        startDate: Date;
        endDate: Date;
    }>;
    recentContent: Array<{
        id: number;
        title: string;
        batchName: string;
        createdAt: Date;
    }>;
}

export interface StudentDashboardResponse {
    stats: StudentDashboardStats;
    myBatches: Array<{
        id: number;
        displayName: string;
        courseName: string;
        startDate: Date;
        endDate: Date;
        isActive: boolean;
    }>;
    recentAnnouncements: Array<{
        id: number;
        heading: string;
        content: string;
        startDate: Date;
        endDate: Date;
    }>;
    recentContent: Array<{
        id: number;
        title: string;
        batchName: string;
        type: string;
        createdAt: Date;
    }>;
}

import { prisma } from '../config/database';
import { ContentStatus, UserRole, UserStatus } from '@prisma/client';

// Common query for active announcements
const getActiveAnnouncementsWhere = (businessId: number, visibleTo: 'admins' | 'teachers' | 'students') => {
    const now = new Date();
    const visibilityField = visibleTo === 'admins' ? 'visibleToAdmins' : 
                           visibleTo === 'teachers' ? 'visibleToTeachers' : 
                           'visibleToStudents';
    
    return {
        businessId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        [visibilityField]: true
    };
};

// Admin Dashboard Queries
export async function getAdminStats(businessId: number) {
    const now = new Date();
    
    const [
        totalUsers,
        totalTeachers,
        totalStudents,
        totalExams,
        totalCourses,
        totalBatches,
        totalContent,
        activeAnnouncements
    ] = await Promise.all([
        prisma.user.count({
            where: { businessId, status: UserStatus.ACTIVE }
        }),
        prisma.user.count({
            where: { businessId, role: UserRole.TEACHER, status: UserStatus.ACTIVE }
        }),
        prisma.user.count({
            where: { businessId, role: UserRole.STUDENT, status: UserStatus.ACTIVE }
        }),
        prisma.exam.count({
            where: { businessId }
        }),
        prisma.course.count({
            where: { exam: { businessId } }
        }),
        prisma.batch.count({
            where: { course: { exam: { businessId } } }
        }),
        prisma.content.count({
            where: { batch: { course: { exam: { businessId } } } }
        }),
        prisma.announcement.count({
            where: getActiveAnnouncementsWhere(businessId, 'admins')
        })
    ]);

    return {
        totalUsers,
        totalTeachers,
        totalStudents,
        totalExams,
        totalCourses,
        totalBatches,
        totalContent,
        activeAnnouncements
    };
}

export async function getAdminDashboardData(businessId: number) {
    const now = new Date();
    
    const [stats, recentUsers, recentAnnouncements, upcomingExams] = await Promise.all([
        getAdminStats(businessId),
        prisma.user.findMany({
            where: { businessId, status: UserStatus.ACTIVE },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            take: 5
        }),
        prisma.announcement.findMany({
            where: getActiveAnnouncementsWhere(businessId, 'admins'),
            select: {
                id: true,
                heading: true,
                startDate: true,
                endDate: true
            },
            orderBy: { createdAt: 'desc' },
            take: 5
        }),
        prisma.exam.findMany({
            where: {
                businessId,
                startDate: { gte: now }
            },
            select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true
            },
            orderBy: { startDate: 'asc' },
            take: 5
        })
    ]);

    return {
        stats,
        recentUsers,
        recentAnnouncements,
        upcomingExams
    };
}

// Teacher Dashboard Queries
export async function getTeacherDashboardData(businessId: number, userId: number) {
    const now = new Date();
    
    // Get unique batch IDs where teacher uploaded content
    const teacherBatches = await prisma.content.findMany({
        where: {
            uploadedBy: userId,
            batch: { course: { exam: { businessId } } }
        },
        select: { batchId: true },
        distinct: ['batchId']
    });

    const batchIds = teacherBatches.map(b => b.batchId);

    // If no batches, return empty data
    if (batchIds.length === 0) {
        return {
            stats: {
                totalBatches: 0,
                totalStudents: 0,
                totalContent: 0,
                activeAnnouncements: 0
            },
            myBatches: [],
            recentAnnouncements: [],
            recentContent: []
        };
    }

    const [totalContent, activeAnnouncements, batches, recentAnnouncements, recentContent] = await Promise.all([
        prisma.content.count({
            where: { uploadedBy: userId }
        }),
        prisma.announcement.count({
            where: getActiveAnnouncementsWhere(businessId, 'teachers')
        }),
        prisma.batch.findMany({
            where: { id: { in: batchIds } },
            select: {
                id: true,
                displayName: true,
                isActive: true,
                course: {
                    select: { name: true }
                },
                _count: {
                    select: {
                        batchUsers: {
                            where: { isActive: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        }),
        prisma.announcement.findMany({
            where: getActiveAnnouncementsWhere(businessId, 'teachers'),
            select: {
                id: true,
                heading: true,
                startDate: true,
                endDate: true
            },
            orderBy: { createdAt: 'desc' },
            take: 5
        }),
        prisma.content.findMany({
            where: { uploadedBy: userId, status: ContentStatus.ACTIVE },
            select: {
                id: true,
                title: true,
                createdAt: true,
                batch: {
                    select: { displayName: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 5
        })
    ]);

    // Count unique students across all batches
    const uniqueStudents = await prisma.batchUser.groupBy({
        by: ['userId'],
        where: {
            batchId: { in: batchIds },
            isActive: true
        }
    });

    const formattedBatches = batches.map(batch => ({
        id: batch.id,
        displayName: batch.displayName,
        courseName: batch.course.name,
        studentCount: batch._count.batchUsers,
        isActive: batch.isActive
    }));

    const formattedContent = recentContent.map(content => ({
        id: content.id,
        title: content.title,
        batchName: content.batch.displayName,
        createdAt: content.createdAt
    }));

    return {
        stats: {
            totalBatches: batchIds.length,
            totalStudents: uniqueStudents.length,
            totalContent,
            activeAnnouncements
        },
        myBatches: formattedBatches,
        recentAnnouncements,
        recentContent: formattedContent
    };
}

// Student Dashboard Queries
export async function getStudentDashboardData(businessId: number, userId: number) {
    const now = new Date();
    
    // Get student's enrolled batches
    const studentBatchUsers = await prisma.batchUser.findMany({
        where: {
            userId,
            isActive: true,
            batch: { course: { exam: { businessId } } }
        },
        select: { batchId: true }
    });

    const batchIds = studentBatchUsers.map(b => b.batchId);

    // If not enrolled in any batch, return empty data
    if (batchIds.length === 0) {
        return {
            stats: {
                enrolledBatches: 0,
                totalContent: 0,
                activeAnnouncements: 0,
                upcomingExams: 0
            },
            myBatches: [],
            recentAnnouncements: [],
            recentContent: []
        };
    }

    const [totalContent, activeAnnouncements, upcomingExams, batches, recentAnnouncements, recentContent] = await Promise.all([
        prisma.content.count({
            where: { batchId: { in: batchIds } }
        }),
        prisma.announcement.count({
            where: getActiveAnnouncementsWhere(businessId, 'students')
        }),
        prisma.exam.count({
            where: {
                businessId,
                startDate: { gte: now }
            }
        }),
        prisma.batch.findMany({
            where: { id: { in: batchIds } },
            select: {
                id: true,
                displayName: true,
                startDate: true,
                endDate: true,
                isActive: true,
                course: {
                    select: { name: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        }),
        prisma.announcement.findMany({
            where: getActiveAnnouncementsWhere(businessId, 'students'),
            select: {
                id: true,
                heading: true,
                content: true,
                startDate: true,
                endDate: true
            },
            orderBy: { createdAt: 'desc' },
            take: 5
        }),
        prisma.content.findMany({
            where: { batchId: { in: batchIds } },
            select: {
                id: true,
                title: true,
                type: true,
                createdAt: true,
                batch: {
                    select: { displayName: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 5
        })
    ]);

    const formattedBatches = batches.map(batch => ({
        id: batch.id,
        displayName: batch.displayName,
        courseName: batch.course.name,
        startDate: batch.startDate,
        endDate: batch.endDate,
        isActive: batch.isActive
    }));

    const formattedContent = recentContent.map(content => ({
        id: content.id,
        title: content.title,
        batchName: content.batch.displayName,
        type: content.type,
        createdAt: content.createdAt
    }));

    return {
        stats: {
            enrolledBatches: batchIds.length,
            totalContent,
            activeAnnouncements,
            upcomingExams
        },
        myBatches: formattedBatches,
        recentAnnouncements,
        recentContent: formattedContent
    };
}

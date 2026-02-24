import { prisma } from '../config/database';
import { ContentStatus, UserRole, UserStatus } from '@prisma/client';

const DASHBOARD_PREVIEW_LIMIT = 5;
const BATCH_PREVIEW_LIMIT = 5;

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

const getTeacherBatchWhere = (businessId: number, userId: number) => ({
    course: { exam: { businessId } },
    contents: { some: { uploadedBy: userId } }
});

const getStudentBatchWhere = (businessId: number, userId: number) => ({
    course: { exam: { businessId } },
    batchUsers: {
        some: {
            userId,
            isActive: true
        }
    }
});

// Admin Dashboard Queries
export async function getAdminStats(businessId: number) {
    const [
        totalUsers,
        totalTeachers,
        totalStudents,
        totalExams,
        totalCourses,
        totalBatches,
        totalContent,
        activeAnnouncements
    ] = await prisma.$transaction([
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
            take: DASHBOARD_PREVIEW_LIMIT
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
            take: DASHBOARD_PREVIEW_LIMIT
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
            take: DASHBOARD_PREVIEW_LIMIT
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
    const batchWhere = getTeacherBatchWhere(businessId, userId);

    // Fast exit before running heavier dashboard queries
    const totalBatches = await prisma.batch.count({
        where: batchWhere
    });

    // If no batches, return empty data
    if (totalBatches === 0) {
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

    const [totalContent, activeAnnouncements, batches, uniqueStudents, recentAnnouncements, recentContent] = await prisma.$transaction([
        prisma.content.count({
            where: {
                uploadedBy: userId,
                status: ContentStatus.ACTIVE,
                batch: { course: { exam: { businessId } } }
            }
        }),
        prisma.announcement.count({
            where: getActiveAnnouncementsWhere(businessId, 'teachers')
        }),
        prisma.batch.findMany({
            where: batchWhere,
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
            take: BATCH_PREVIEW_LIMIT
        }),
        prisma.batchUser.groupBy({
            by: ['userId'],
            orderBy: {
                userId: 'asc'
            },
            where: {
                isActive: true,
                batch: batchWhere
            }
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
            take: DASHBOARD_PREVIEW_LIMIT
        }),
        prisma.content.findMany({
            where: {
                uploadedBy: userId,
                status: ContentStatus.ACTIVE,
                batch: { course: { exam: { businessId } } }
            },
            select: {
                id: true,
                title: true,
                createdAt: true,
                batch: {
                    select: { displayName: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: DASHBOARD_PREVIEW_LIMIT
        })
    ]);

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
            totalBatches,
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
    const batchWhere = getStudentBatchWhere(businessId, userId);

    // Fast exit before running heavier dashboard queries
    const enrolledBatches = await prisma.batchUser.count({
        where: {
            userId,
            isActive: true,
            batch: { course: { exam: { businessId } } }
        }
    });

    // If not enrolled in any batch, return empty data
    if (enrolledBatches === 0) {
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

    const [totalContent, activeAnnouncements, upcomingExams, batches, recentAnnouncements, recentContent] = await prisma.$transaction([
        prisma.content.count({
            where: { batch: batchWhere }
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
            where: batchWhere,
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
            take: BATCH_PREVIEW_LIMIT
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
            take: DASHBOARD_PREVIEW_LIMIT
        }),
        prisma.content.findMany({
            where: { batch: batchWhere },
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
            take: DASHBOARD_PREVIEW_LIMIT
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
            enrolledBatches,
            totalContent,
            activeAnnouncements,
            upcomingExams
        },
        myBatches: formattedBatches,
        recentAnnouncements,
        recentContent: formattedContent
    };
}

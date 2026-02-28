import { prisma } from '../config/database';
import { ContentStatus, ExamStatus, Prisma, UserRole, UserStatus } from '@prisma/client';

const DASHBOARD_PREVIEW_LIMIT = 5;

type AnnouncementAudience = 'admins' | 'teachers' | 'students';

const getActiveAnnouncementsWhere = (
    businessId: number,
    visibleTo: AnnouncementAudience
): Prisma.AnnouncementWhereInput => {
    const now = new Date();
    const visibilityField =
        visibleTo === 'admins'
            ? 'visibleToAdmins'
            : visibleTo === 'teachers'
                ? 'visibleToTeachers'
                : 'visibleToStudents';

    return {
        businessId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        [visibilityField]: true
    };
};

const getTeacherBatchWhere = (businessId: number, userId: number): Prisma.BatchWhereInput => ({
    isActive: true,
    course: { exam: { businessId, status: ExamStatus.ACTIVE } },
    batchUsers: {
        some: {
            userId,
            isActive: true,
            user: {
                role: UserRole.TEACHER,
                status: UserStatus.ACTIVE
            }
        }
    }
});

const getStudentBatchWhere = (businessId: number, userId: number): Prisma.BatchWhereInput => ({
    isActive: true,
    course: { exam: { businessId, status: ExamStatus.ACTIVE } },
    batchUsers: {
        some: {
            userId,
            isActive: true,
            user: {
                role: UserRole.STUDENT,
                status: UserStatus.ACTIVE
            }
        }
    }
});

const countActiveAnnouncements = (businessId: number, visibleTo: AnnouncementAudience) =>
    prisma.announcement.count({
        where: getActiveAnnouncementsWhere(businessId, visibleTo)
    });

const findRecentAnnouncements = <T extends Prisma.AnnouncementSelect>(
    businessId: number,
    visibleTo: AnnouncementAudience,
    select: T
) =>
    prisma.announcement.findMany({
        where: getActiveAnnouncementsWhere(businessId, visibleTo),
        select,
        orderBy: { createdAt: 'desc' },
        take: DASHBOARD_PREVIEW_LIMIT
    });

const countContent = (where: Prisma.ContentWhereInput) =>
    prisma.content.count({ where });

const findRecentContent = <T extends Prisma.ContentSelect>(
    where: Prisma.ContentWhereInput,
    select: T
) =>
    prisma.content.findMany({
        where,
        select,
        orderBy: { createdAt: 'desc' },
        take: DASHBOARD_PREVIEW_LIMIT
    });

const findBatches = <T extends Prisma.BatchSelect>(
    where: Prisma.BatchWhereInput,
    select: T
) =>
    prisma.batch.findMany({
        where,
        select,
        orderBy: { createdAt: 'desc' }
    });

const countTeacherUniqueStudents = async (batchWhere: Prisma.BatchWhereInput) => {
    const result = await prisma.batchUser.findMany({
        where: {
            isActive: true,
            batch: batchWhere,
            user: {
                role: UserRole.STUDENT,
                status: UserStatus.ACTIVE
            }
        },
        select: { userId: true },
        distinct: ['userId']
    });

    return result.length;
};

// Admin Dashboard Queries
export async function getAdminStats(businessId: number) {
    const activeUsersByRolePromise = prisma.user.groupBy({
        by: ['role'],
        where: { businessId, status: UserStatus.ACTIVE },
        _count: { _all: true }
    });

    const [
        activeUsersByRole,
        totalExams,
        totalCourses,
        totalBatches,
        totalContent,
        activeAnnouncements
    ] = await prisma.$transaction([
        activeUsersByRolePromise,
        prisma.exam.count({
            where: { businessId, status: ExamStatus.ACTIVE }
        }),
        prisma.course.count({
            where: { exam: { businessId, status: ExamStatus.ACTIVE } }
        }),
        prisma.batch.count({
            where: {
                isActive: true,
                course: { exam: { businessId, status: ExamStatus.ACTIVE } }
            }
        }),
        countContent({
            batch: { isActive: true, course: { exam: { businessId, status: ExamStatus.ACTIVE } } },
            status: ContentStatus.ACTIVE
        }),
        countActiveAnnouncements(businessId, 'admins')
    ]);

    const roleCounts = new Map(activeUsersByRole.map((item) => [item.role, item._count._all]));
    const totalUsers = activeUsersByRole.reduce((sum, item) => sum + item._count._all, 0);
    const totalTeachers = roleCounts.get(UserRole.TEACHER) ?? 0;
    const totalStudents = roleCounts.get(UserRole.STUDENT) ?? 0;

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

const getAdminRecentUsers = (businessId: number) =>
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
    });

export async function getAdminDashboardData(businessId: number) {
    const [stats, recentUsers, recentAnnouncements] = await Promise.all([
        getAdminStats(businessId),
        getAdminRecentUsers(businessId),
        findRecentAnnouncements(businessId, 'admins', {
            id: true,
            heading: true,
            startDate: true,
            endDate: true
        })
    ]);

    return {
        stats,
        recentUsers,
        recentAnnouncements
    };
}

// Teacher Dashboard Queries
export async function getTeacherDashboardData(businessId: number, userId: number) {
    const batchWhere = getTeacherBatchWhere(businessId, userId);
    const contentWhere: Prisma.ContentWhereInput = {
        status: ContentStatus.ACTIVE,
        batch: batchWhere
    };

    const totalBatches = await prisma.batch.count({ where: batchWhere });
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

    const [totalContent, activeAnnouncements, batches, recentAnnouncements, recentContent] =
        await prisma.$transaction([
            countContent(contentWhere),
            countActiveAnnouncements(businessId, 'teachers'),
            findBatches(batchWhere, {
                id: true,
                displayName: true,
                isActive: true,
                course: {
                    select: { name: true }
                },
            }),
            findRecentAnnouncements(businessId, 'teachers', {
                id: true,
                heading: true,
                startDate: true,
                endDate: true
            }),
            findRecentContent(contentWhere, {
                id: true,
                title: true,
                createdAt: true,
                batch: {
                    select: { displayName: true }
                }
            })
        ]);

    const uniqueStudents = await countTeacherUniqueStudents(batchWhere);

    return {
        stats: {
            totalBatches,
            totalStudents: uniqueStudents,
            totalContent,
            activeAnnouncements
        },
        myBatches: batches,
        recentAnnouncements,
        recentContent: recentContent
    };
}

// Student Dashboard Queries
export async function getStudentDashboardData(businessId: number, userId: number) {
    const batchWhere = getStudentBatchWhere(businessId, userId);
    const contentWhere: Prisma.ContentWhereInput = { batch: batchWhere, status: ContentStatus.ACTIVE };

    const enrolledBatches = await prisma.batchUser.count({
        where: {
            userId,
            isActive: true,
            batch: { isActive: true, course: { exam: { businessId, status: ExamStatus.ACTIVE } } },
            user: {
                role: UserRole.STUDENT,
                status: UserStatus.ACTIVE
            }
        }
    });

    if (enrolledBatches === 0) {
        return {
            stats: {
                enrolledBatches: 0,
                totalContent: 0,
                activeAnnouncements: 0
            },
            myBatches: [],
            recentAnnouncements: [],
            recentContent: []
        };
    }

    const [totalContent, activeAnnouncements, batches, recentAnnouncements, recentContent] = await prisma.$transaction([
        countContent(contentWhere),
        countActiveAnnouncements(businessId, 'students'),
        findBatches(batchWhere, {
            id: true,
            displayName: true,
            startDate: true,
            endDate: true,
            isActive: true,
            course: {
                select: { name: true }
            }
        }),
        findRecentAnnouncements(businessId, 'students', {
            id: true,
            heading: true,
            content: true,
            startDate: true,
            endDate: true
        }),
        findRecentContent(contentWhere, {
            id: true,
            title: true,
            type: true,
            createdAt: true,
            batch: {
                select: { displayName: true }
            }
        })
    ]);

    return {
        stats: {
            enrolledBatches,
            totalContent,
            activeAnnouncements
        },
        myBatches: batches,
        recentAnnouncements,
        recentContent: recentContent,
    };
}

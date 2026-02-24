import { prisma } from '../config/database';
import { ContentStatus, Prisma, UserRole, UserStatus } from '@prisma/client';

const DASHBOARD_PREVIEW_LIMIT = 5;
const BATCH_PREVIEW_LIMIT = 5;

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
    course: { exam: { businessId } },
    contents: { some: { uploadedBy: userId } }
});

const getStudentBatchWhere = (businessId: number, userId: number): Prisma.BatchWhereInput => ({
    course: { exam: { businessId } },
    batchUsers: {
        some: {
            userId,
            isActive: true
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
        orderBy: { createdAt: 'desc' },
        take: BATCH_PREVIEW_LIMIT
    });

const countTeacherUniqueStudents = (batchWhere: Prisma.BatchWhereInput) =>
    prisma.batchUser.groupBy({
        by: ['userId'],
        orderBy: { userId: 'asc' },
        where: {
            isActive: true,
            batch: batchWhere
        }
    });

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
            where: { businessId }
        }),
        prisma.course.count({
            where: { exam: { businessId } }
        }),
        prisma.batch.count({
            where: { course: { exam: { businessId } } }
        }),
        countContent({
            batch: { course: { exam: { businessId } } }
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
        uploadedBy: userId,
        status: ContentStatus.ACTIVE,
        batch: { course: { exam: { businessId } } }
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

    const [totalContent, activeAnnouncements, batches, uniqueStudents, recentAnnouncements, recentContent] =
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
            countTeacherUniqueStudents(batchWhere),
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

    return {
        stats: {
            totalBatches,
            totalStudents: uniqueStudents.length,
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
    const contentWhere: Prisma.ContentWhereInput = { batch: batchWhere };

    const enrolledBatches = await prisma.batchUser.count({
        where: {
            userId,
            isActive: true,
            batch: { course: { exam: { businessId } } }
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

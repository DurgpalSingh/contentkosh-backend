import { AnnouncementScope } from '@prisma/client';

export interface AnnouncementTargetInput {
  courseId?: number | null;
  batchId?: number | null;
}

export interface CreateAnnouncementDto {
  heading: string;
  content: string;
  startDate: string;
  endDate: string;
  isActive?: boolean;
  visibleToAdmins?: boolean;
  visibleToTeachers?: boolean;
  visibleToStudents?: boolean;
  scope: AnnouncementScope;
  targetAllCourses?: boolean;
  targetAllBatches?: boolean;
  /** When scope is COURSE and targetAllCourses is false, required (non-empty). */
  courseIds?: number[];
  /** When scope is BATCH and targetAllBatches is false, required (non-empty). */
  batchIds?: number[];
}

export interface UpdateAnnouncementDto {
  heading?: string;
  content?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  visibleToAdmins?: boolean;
  visibleToTeachers?: boolean;
  visibleToStudents?: boolean;
  scope?: AnnouncementScope;
  targetAllCourses?: boolean;
  targetAllBatches?: boolean;
  courseIds?: number[];
  batchIds?: number[];
}

export interface AnnouncementTargetDto {
  id: number;
  announcementId: number;
  courseId: number | null;
  batchId: number | null;
  createdAt: Date;
}

export interface AnnouncementCreatorSummary {
  id: number;
  name: string;
  email: string;
}

export interface AnnouncementWithTargetsDto {
  id: number;
  heading: string;
  content: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  businessId: number;
  visibleToAdmins: boolean;
  visibleToTeachers: boolean;
  visibleToStudents: boolean;
  scope: AnnouncementScope;
  targetAllCourses: boolean;
  targetAllBatches: boolean;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  targets: AnnouncementTargetDto[];
  createdByUser: AnnouncementCreatorSummary | null;
}

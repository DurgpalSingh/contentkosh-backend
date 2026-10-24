import { AnnouncementScope } from '@prisma/client';
import { announcementPushService } from '../../../src/services/announcementPush.service';
import * as announcementRepo from '../../../src/repositories/announcement.repo';
import { fcmPushService } from '../../../src/services/fcmPush.service';

jest.mock('../../../src/repositories/announcement.repo');
jest.mock('../../../src/repositories/business.repo');
jest.mock('../../../src/services/fcmPush.service');
jest.mock('../../../src/utils/logger');

const HOUR = 60 * 60 * 1000;

function buildAnnouncement(overrides: Partial<Parameters<typeof announcementPushService.notifySaved>[1]> = {}) {
  return {
    id: 42,
    heading: 'Exam schedule',
    content: 'The   mock exam\nis on Friday.',
    startDate: new Date(Date.now() - HOUR),
    endDate: new Date(Date.now() + HOUR),
    isActive: true,
    visibleToAdmins: false,
    visibleToTeachers: false,
    visibleToStudents: true,
    scope: AnnouncementScope.BATCH,
    targetAllCourses: false,
    targetAllBatches: false,
    targets: [{ courseId: null, batchId: 3 }],
    ...overrides,
  };
}

/** notifySaved sends in the background; let that promise chain finish. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('announcementPushService.notifySaved', () => {
  beforeEach(() => {
    (fcmPushService.sendToTopics as jest.Mock).mockResolvedValue(undefined);
  });

  it('sends to the targeted batch topics for each visible role', async () => {
    (announcementRepo.resolveBatchIdsForEmit as jest.Mock).mockResolvedValue([3, 4]);

    announcementPushService.notifySaved(7, buildAnnouncement({ visibleToTeachers: true }), 'created');
    await flush();

    expect(fcmPushService.sendToTopics).toHaveBeenCalledWith(
      ['ck-b7-batch3-teachers', 'ck-b7-batch3-students', 'ck-b7-batch4-teachers', 'ck-b7-batch4-students'],
      {
        title: 'Exam schedule',
        body: 'The mock exam is on Friday.',
        data: { type: 'announcement', announcementId: '42', businessId: '7' },
      },
    );
  });

  it('uses the "all" topics when everyone is targeted, plus admins when visible to them', async () => {
    announcementPushService.notifySaved(
      7,
      buildAnnouncement({ targetAllBatches: true, visibleToAdmins: true, targets: [] }),
      'updated',
    );
    await flush();

    expect(announcementRepo.resolveBatchIdsForEmit).not.toHaveBeenCalled();
    expect(fcmPushService.sendToTopics).toHaveBeenCalledWith(
      ['ck-b7-admins', 'ck-b7-students-all'],
      expect.objectContaining({ title: 'Updated: Exam schedule' }),
    );
  });

  it('defers announcements that have not started yet (the scheduled check sends them)', async () => {
    announcementPushService.notifySaved(7, buildAnnouncement({ startDate: new Date(Date.now() + HOUR) }), 'created');
    await flush();

    expect(fcmPushService.sendToTopics).not.toHaveBeenCalled();
  });

  it('skips inactive announcements', async () => {
    announcementPushService.notifySaved(7, buildAnnouncement({ isActive: false }), 'created');
    await flush();

    expect(fcmPushService.sendToTopics).not.toHaveBeenCalled();
  });
});

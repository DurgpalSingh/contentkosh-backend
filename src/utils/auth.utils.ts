import { BusinessStatus, UserRole } from '@prisma/client';
import { BUSINESS_STATUS_ACTION } from '../constants/business.constants';
import { BusinessSuspendedError } from '../errors/api.errors';
import { LoginRequest } from '../dtos/auth.dto';

export function resolveLoginSlug(data: LoginRequest): string | undefined {
  return data.slug?.trim() || data.businessSlug?.trim() || undefined;
}

export function buildBusinessSuspendedError(business: { status: BusinessStatus; statusReason: string | null }): BusinessSuspendedError {
  const action = business.status === BusinessStatus.PAUSED ? BUSINESS_STATUS_ACTION.PAUSED : BUSINESS_STATUS_ACTION.REMOVED;
  return new BusinessSuspendedError(action, business.statusReason);
}

/** The user fields a signup response exposes; everything else (password hash, timestamps) stays server-side. */
export function toRegisteredUser(user: { id: number; email: string; name: string; role: UserRole; businessId: number | null }) {
  const { id, email, name, role, businessId } = user;
  return { id, email, name, role, businessId };
}

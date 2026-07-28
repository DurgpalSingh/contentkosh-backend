import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { requestContext } from '../contexts/request-context';
import * as businessRepo from '../repositories/business.repo';

export async function tenantResolver(req: Request, _res: Response, next: NextFunction) {
  try {
    const headerSlug = (req.header('X-Tenant-Slug') || req.header('x-tenant-slug')) as string | undefined;
    const paramSlug = (req.params && (req.params as any).slug) as string | undefined;
    const querySlug = (req.query && (req.query as any).slug) as string | undefined;

    const slug = headerSlug || paramSlug || querySlug;
    let tenant = undefined;

    if (slug) {
      const business = await businessRepo.findBusinessBySlug(slug);
      if (business && business.schemaName) {
        tenant = {
          businessId: business.id,
          ...(business.slug ? { slug: business.slug } : {}),
          schemaName: business.schemaName,
        };
      }
    }

    // Initialize request context for the request so downstream code can set user/tenant
    requestContext.run({ user: undefined as any, tenant }, () => {
      next();
    });
  } catch (error) {
    logger.error('Tenant resolver failed', { error });
    next(error);
  }
}

export default tenantResolver;

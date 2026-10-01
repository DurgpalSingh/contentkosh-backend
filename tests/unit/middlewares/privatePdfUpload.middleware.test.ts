import express from 'express';
import request from 'supertest';
import { requestContext } from '../../../src/contexts/request-context';
import { createPrivatePdfUpload } from '../../../src/middlewares/upload.middleware';

/**
 * Regression: multer calls back outside AsyncLocalStorage when the multipart body has no
 * file part, which made tenant-scoped queries hit the public schema ("Batch not found").
 */
describe('createPrivatePdfUpload request context', () => {
  const TENANT = { businessId: 1, schemaName: 'tenant_demo' };

  const app = express();
  app.use((_req, _res, next) => requestContext.run({ user: undefined, tenant: TENANT }, () => next()));
  app.post('/upload', createPrivatePdfUpload('questionPaper'), (req, res) => {
    res.json({ tenant: requestContext.getTenant() ?? null, batchId: req.body.batchId });
  });

  it('keeps the tenant context when only the data field is sent', async () => {
    const res = await request(app).post('/upload').field('data', JSON.stringify({ batchId: 3 }));
    expect(res.body).toEqual({ tenant: TENANT, batchId: 3 });
  });

  it('keeps the tenant context when a file is attached', async () => {
    const res = await request(app)
      .post('/upload')
      .field('data', JSON.stringify({ batchId: 3 }))
      .attach('questionPaper', Buffer.from('%PDF-1.4\n'), { filename: 'paper.pdf', contentType: 'application/pdf' });
    expect(res.body).toEqual({ tenant: TENANT, batchId: 3 });
  });
});

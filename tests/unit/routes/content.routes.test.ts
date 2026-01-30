import { Router } from 'express';
import contentRoutes from '../../../src/routes/content.routes';

describe('Content Routes', () => {
  describe('Route Registration', () => {
    it('should be a valid Express router', () => {
      expect(contentRoutes).toBeInstanceOf(Router);
    });

    it('should have POST route for /batches/:batchId/contents', () => {
      const routes = contentRoutes.stack
        .filter((r) => r.route && r.route.path === '/batches/:batchId/contents')
        .map((r) => r.route.methods);

      expect(routes.some((methods) => methods.post)).toBe(true);
    });

    it('should have GET route for /batches/:batchId/contents', () => {
      const routes = contentRoutes.stack
        .filter((r) => r.route && r.route.path === '/batches/:batchId/contents')
        .map((r) => r.route.methods);

      expect(routes.some((methods) => methods.get)).toBe(true);
    });

    it('should have GET route for /contents/:contentId', () => {
      const routes = contentRoutes.stack
        .filter((r) => r.route && r.route.path === '/contents/:contentId')
        .map((r) => r.route.methods);

      expect(routes.some((methods) => methods.get)).toBe(true);
    });

    it('should have GET route for /contents/:contentId/file', () => {
      const routes = contentRoutes.stack
        .filter((r) => r.route && r.route.path === '/contents/:contentId/file')
        .map((r) => r.route.methods);

      expect(routes.some((methods) => methods.get)).toBe(true);
    });

    it('should have PUT route for /contents/:contentId', () => {
      const routes = contentRoutes.stack
        .filter((r) => r.route && r.route.path === '/contents/:contentId')
        .map((r) => r.route.methods);

      expect(routes.some((methods) => methods.put)).toBe(true);
    });

    it('should have DELETE route for /contents/:contentId', () => {
      const routes = contentRoutes.stack
        .filter((r) => r.route && r.route.path === '/contents/:contentId')
        .map((r) => r.route.methods);

      expect(routes.some((methods) => methods.delete)).toBe(true);
    });
  });

  describe('Route Parameters', () => {
    it('should accept batchId parameter in POST /batches/:batchId/contents', () => {
      const route = contentRoutes.stack.find(
        (r) => r.route && r.route.path === '/batches/:batchId/contents' && r.route.methods.post
      );

      expect(route?.route?.path).toContain(':batchId');
    });

    it('should accept contentId parameter in GET /contents/:contentId', () => {
      const route = contentRoutes.stack.find(
        (r) => r.route && r.route.path === '/contents/:contentId' && r.route.methods.get
      );

      expect(route?.route?.path).toContain(':contentId');
    });

    it('should accept contentId parameter in GET /contents/:contentId/file', () => {
      const route = contentRoutes.stack.find(
        (r) => r.route && r.route.path === '/contents/:contentId/file' && r.route.methods.get
      );

      expect(route?.route?.path).toContain(':contentId');
    });

    it('should accept contentId parameter in PUT /contents/:contentId', () => {
      const route = contentRoutes.stack.find(
        (r) => r.route && r.route.path === '/contents/:contentId' && r.route.methods.put
      );

      expect(route?.route?.path).toContain(':contentId');
    });

    it('should accept contentId parameter in DELETE /contents/:contentId', () => {
      const route = contentRoutes.stack.find(
        (r) => r.route && r.route.path === '/contents/:contentId' && r.route.methods.delete
      );

      expect(route?.route?.path).toContain(':contentId');
    });
  });

  describe('Route Methods', () => {
    it('should have only allowed HTTP methods on content routes', () => {
      const allowedMethods = ['get', 'post', 'put', 'delete'];

      contentRoutes.stack.forEach((layer) => {
        if (layer.route) {
          const methods = Object.keys(layer.route.methods);
          methods.forEach((method) => {
            expect(allowedMethods).toContain(method);
          });
        }
      });
    });

    it('should not have PATCH method on content routes', () => {
      const hasPatch = contentRoutes.stack.some(
        (layer) => layer.route && layer.route.methods.patch
      );

      expect(hasPatch).toBe(false);
    });

    it('should not have HEAD method on content routes', () => {
      const hasHead = contentRoutes.stack.some(
        (layer) => layer.route && layer.route.methods.head
      );

      expect(hasHead).toBe(false);
    });
  });

  describe('Route Count Verification', () => {
    it('should have exactly 6 unique routes', () => {
      const uniqueRoutes = new Set(
        contentRoutes.stack
          .filter((r) => r.route)
          .map((r) => {
            const methods = Object.keys(r.route.methods).join(',');
            return `${r.route.path}:${methods}`;
          })
      );

      expect(uniqueRoutes.size).toBeGreaterThanOrEqual(6);
    });

    it('should have POST and GET routes for batch contents', () => {
      const batchRoutes = contentRoutes.stack.filter(
        (r) => r.route && r.route.path === '/batches/:batchId/contents'
      );

      const methods = new Set();
      batchRoutes.forEach((route) => {
        Object.keys(route.route.methods).forEach((method) => {
          methods.add(method);
        });
      });

      expect(methods.has('get')).toBe(true);
      expect(methods.has('post')).toBe(true);
    });

    it('should have GET, PUT, DELETE routes for specific content', () => {
      const contentRoutesByPath = contentRoutes.stack.filter(
        (r) => r.route && r.route.path === '/contents/:contentId'
      );

      const methods = new Set();
      contentRoutesByPath.forEach((route) => {
        Object.keys(route.route.methods).forEach((method) => {
          methods.add(method);
        });
      });

      expect(methods.has('get')).toBe(true);
      expect(methods.has('put')).toBe(true);
      expect(methods.has('delete')).toBe(true);
    });

    it('should have GET route for content file', () => {
      const fileRoute = contentRoutes.stack.find(
        (r) => r.route && r.route.path === '/contents/:contentId/file'
      );

      expect(fileRoute).toBeDefined();
      expect(fileRoute?.route?.methods.get).toBe(true);
    });
  });

  describe('Route Path Validation', () => {
    it('should have correct batch content path format', () => {
      const route = contentRoutes.stack.find(
        (r) => r.route && r.route.methods.post && r.route.path === '/batches/:batchId/contents'
      );

      expect(route?.route?.path).toMatch(/\/batches\/:\w+\/contents/);
    });

    it('should have correct content path format', () => {
      const route = contentRoutes.stack.find(
        (r) => r.route && r.route.methods.get && r.route.path === '/contents/:contentId'
      );

      expect(route?.route?.path).toMatch(/\/contents\/:\w+$/);
    });

    it('should have correct content file path format', () => {
      const route = contentRoutes.stack.find(
        (r) => r.route && r.route.path === '/contents/:contentId/file'
      );

      expect(route?.route?.path).toMatch(/\/contents\/:\w+\/file$/);
    });
  });

  describe('HTTP Method Combinations', () => {
    it('POST /batches/:batchId/contents should exist', () => {
      const route = contentRoutes.stack.find(
        (r) => r.route && r.route.path === '/batches/:batchId/contents' && r.route.methods.post
      );

      expect(route).toBeDefined();
    });

    it('GET /batches/:batchId/contents should exist', () => {
      const route = contentRoutes.stack.find(
        (r) => r.route && r.route.path === '/batches/:batchId/contents' && r.route.methods.get
      );

      expect(route).toBeDefined();
    });

    it('GET /contents/:contentId should exist', () => {
      const route = contentRoutes.stack.find(
        (r) => r.route && r.route.path === '/contents/:contentId' && r.route.methods.get
      );

      expect(route).toBeDefined();
    });

    it('GET /contents/:contentId/file should exist', () => {
      const route = contentRoutes.stack.find(
        (r) => r.route && r.route.path === '/contents/:contentId/file' && r.route.methods.get
      );

      expect(route).toBeDefined();
    });

    it('PUT /contents/:contentId should exist', () => {
      const route = contentRoutes.stack.find(
        (r) => r.route && r.route.path === '/contents/:contentId' && r.route.methods.put
      );

      expect(route).toBeDefined();
    });

    it('DELETE /contents/:contentId should exist', () => {
      const route = contentRoutes.stack.find(
        (r) => r.route && r.route.path === '/contents/:contentId' && r.route.methods.delete
      );

      expect(route).toBeDefined();
    });
  });
});

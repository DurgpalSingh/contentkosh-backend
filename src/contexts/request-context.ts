import { AsyncLocalStorage } from 'async_hooks';
import { IUser } from '../dtos/auth.dto';

export interface RequestContextData {
  user: IUser | undefined;
  tenant: {
    businessId?: number;
    slug?: string;
    schemaName?: string;
  } | undefined;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContextData>();

export const requestContext = {
  run<T = void>(data: RequestContextData, callback: () => T): T {
    return asyncLocalStorage.run(data, callback) as T;
  },

  get(): RequestContextData | undefined {
    return asyncLocalStorage.getStore();
  },

  /**
   * Wraps a callback so it runs inside the current request context. Needed for libraries
   * that invoke callbacks outside it (e.g. multer with a body that has no file part).
   */
  bind<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
    const store = asyncLocalStorage.getStore();
    if (!store) return fn;
    return (...args: A) => asyncLocalStorage.run(store, () => fn(...args));
  },

  setUser(user: RequestContextData['user']) {
    const store = asyncLocalStorage.getStore();
    if (store) store.user = user;
  },

  setTenant(tenant: RequestContextData['tenant'] | undefined) {
    const store = asyncLocalStorage.getStore();
    if (store) {
      if (tenant === undefined) {
        // Remove the property to respect exact optional property types
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (store as any).tenant;
      } else {
        store.tenant = tenant;
      }
    }
  },

  getUser(): IUser {
    const store = asyncLocalStorage.getStore();
    if (!store) throw new Error('Request context not found');
    if (!store.user) throw new Error('User not found in request context');
    return store.user;
  },

  getOptionalUser(): IUser | undefined {
    const store = asyncLocalStorage.getStore();
    return store?.user;
  },

  getTenant(): RequestContextData['tenant'] | undefined {
    const store = asyncLocalStorage.getStore();
    return store?.tenant;
  },
};

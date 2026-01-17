import { errorHandler } from '../../../src/middlewares/error.middleware';
import {
    NotFoundError,
    BadRequestError,
    AlreadyExistsError,
    UnauthorizedError,
    ForbiddenError,
    ApiError
} from '../../../src/errors/api.errors';
import { ApiResponseHandler } from '../../../src/utils/apiResponse';

jest.mock('../../../src/utils/apiResponse', () => {
    const originalModule = jest.requireActual('../../../src/utils/apiResponse');
    return {
        ...originalModule,
        // We use the real implementation but we can spy on it if needed, or just check res
        // Actually, better to just let it run real code if it's just util
    };
});


describe('Error Middleware', () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    it('should handle NotFoundError', () => {
        const err = new NotFoundError('Item');
        errorHandler(err, req, res, next);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: expect.stringContaining('Item not found') }));
    });

    it('should handle BadRequestError', () => {
        const err = new BadRequestError('Bad input');
        errorHandler(err, req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Bad input' }));
    });

    it('should handle AlreadyExistsError', () => {
        const err = new AlreadyExistsError('Start date clash');
        errorHandler(err, req, res, next);
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: expect.stringContaining('Start date clash') }));
    });

    it('should handle UnauthorizedError', () => {
        const err = new UnauthorizedError('Go away');
        errorHandler(err, req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Go away' }));
    });

    it('should handle ForbiddenError', () => {
        const err = new ForbiddenError('Not allowed');
        errorHandler(err, req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Not allowed' }));
    });

    it('should handle generic ApiError', () => {
        const err = new ApiError('Teapot', 418);
        errorHandler(err, req, res, next);
        expect(res.status).toHaveBeenCalledWith(418);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Teapot' }));
    });

    it('should handle unknown errors as Server Error', () => {
        const err = new Error('Kaboom');
        errorHandler(err, req, res, next);
        expect(res.status).toHaveBeenCalledWith(500);
    });
});

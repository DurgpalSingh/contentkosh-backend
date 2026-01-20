import { IsString, IsNotEmpty } from 'class-validator';
import { validateDto } from '../../../../src/middlewares/validation/dto.middleware';
import { ApiResponseHandler } from '../../../../src/utils/apiResponse';

jest.unmock('../../../../src/utils/apiResponse');

// Define a proper DTO class with validation decorators
class TestDto {
    @IsString()
    @IsNotEmpty()
    name!: string;
}

describe('DTO Validation Middleware', () => {
    let req: any;
    let res: any;
    let next: any;

    beforeEach(() => {
        req = { body: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    it('should call next if validation passes', (done) => {
        req.body = { name: 'Valid Name' };

        const middleware = validateDto(TestDto);

        middleware(req, res, next);

        // validate is async, so we need to wait a tick or spy
        // However, middleware returns void and calls callback internally.
        // We can use setImmediate to check expectations after promise resolution.
        setImmediate(() => {
            expect(next).toHaveBeenCalled();
            expect(req.body).toBeInstanceOf(TestDto);
            expect(req.body.name).toBe('Valid Name');
            done();
        });
    });

    it('should return bad request if validation fails', (done) => {
        req.body = { name: '' }; // Empty name fails @IsNotEmpty

        const middleware = validateDto(TestDto);

        middleware(req, res, next);

        setImmediate(() => {
            expect(next).not.toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
            done();
        });
    });

    it('should handle skipMissingProperties option', (done) => {
        req.body = {}; // Missing 'name'

        const middleware = validateDto(TestDto, true); // true = skip missing

        middleware(req, res, next);

        setImmediate(() => {
            expect(next).toHaveBeenCalled();
            done();
        });
    });
});

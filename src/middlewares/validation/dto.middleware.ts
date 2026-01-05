import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ApiResponseHandler } from '../../utils/apiResponse';

export function validateDto(type: any, skipMissingProperties = false): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(type, req.body);
        validate(dtoObj, { skipMissingProperties }).then((errors: ValidationError[]) => {
            if (errors.length > 0) {
                const dtoErrors = errors.map((error: ValidationError) =>
                    (Object as any).values(error.constraints)
                ).join(', ');
                return ApiResponseHandler.badRequest(res, dtoErrors);
            } else {
                req.body = dtoObj;
                next();
            }
        });
    };
}

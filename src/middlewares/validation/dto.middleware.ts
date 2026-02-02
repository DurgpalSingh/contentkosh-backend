import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ApiResponseHandler } from '../../utils/apiResponse';

export function validateDto(type: any, skipMissingProperties = false): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        const dtoObj = plainToInstance(type, req.body);
        // collect constraints safely including nested child errors
        const extractConstraintMessages = (errs: ValidationError[]): string[] => {
            return errs.reduce((acc: string[], err) => {
                if (err.constraints) {
                    acc.push(...Object.values(err.constraints));
                }
                if (err.children && err.children.length > 0) {
                    acc.push(...extractConstraintMessages(err.children));
                }
                return acc;
            }, []);
        };

        validate(dtoObj, { skipMissingProperties }).then((errors: ValidationError[]) => {
            if (errors.length > 0) {
                const dtoErrors = extractConstraintMessages(errors).join(', ');
                return ApiResponseHandler.badRequest(res, dtoErrors);
            } else {
                req.body = dtoObj;
                next();
            }
        });
    };
}

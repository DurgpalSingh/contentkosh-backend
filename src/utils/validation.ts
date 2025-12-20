import { BadRequestError } from '../errors/api.errors';

export class ValidationUtils {
    /**
     * Validates that a value is not null or undefined.
     * @param value The value to check.
     * @param fieldName The name of the field for the error message.
     */
    static validateRequired(value: any, fieldName: string): void {
        if (value === null || value === undefined || value === '') {
            throw new BadRequestError(`${fieldName} is required`);
        }
    }

    /**
     * Validates that a string does not exceed a maximum length.
     * @param value The string to check.
     * @param maxLength The maximum allowed length.
     * @param fieldName The name of the field for the error message.
     */
    static validateMaxLength(value: string, maxLength: number, fieldName: string): void {
        if (value && value.length > maxLength) {
            throw new BadRequestError(`${fieldName} cannot exceed ${maxLength} characters`);
        }
    }

    /**
     * Validates that a value is a valid positive integer ID.
     * @param id The ID to check.
     * @param fieldName The name of the field for the error message.
     * @returns The parsed ID as a number.
     */
    static validateId(id: any, fieldName: string = 'ID'): number {
        const parsedId = Number(id);
        if (!Number.isInteger(parsedId) || parsedId <= 0) {
            throw new BadRequestError(`${fieldName} is required and must be a valid positive integer`);
        }
        return parsedId;
    }

    /**
     * Validates that a value is a non-empty string.
     * @param value The value to check.
     * @param fieldName The name of the field for the error message.
     * @returns The trimmed string.
     */
    static validateNonEmptyString(value: string | undefined | null, fieldName: string): string {
        if (!value || typeof value !== 'string' || !value.trim()) {
            throw new BadRequestError(`${fieldName} is required and cannot be empty`);
        }
        return value.trim();
    }

    /**
     * Validates that a start date is before an end date.
     * @param startDate The start date.
     * @param endDate The end date.
     * @param fieldNameStart The name of the start date field.
     * @param fieldNameEnd The name of the end date field.
     * @returns The parsed Date objects.
     */
    static validateDateRange(startDate: Date | string, endDate: Date | string, fieldNameStart: string = 'Start date', fieldNameEnd: string = 'End date'): { start: Date, end: Date } {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime())) {
            throw new BadRequestError(`Invalid ${fieldNameStart}`);
        }
        if (isNaN(end.getTime())) {
            throw new BadRequestError(`Invalid ${fieldNameEnd}`);
        }

        if (start >= end) {
            throw new BadRequestError(`${fieldNameEnd} must be after ${fieldNameStart}`);
        }

        return { start, end };
    }
}

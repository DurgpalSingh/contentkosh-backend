import 'reflect-metadata';
import logger from '../src/utils/logger';

// Mock Prisma Client globally
jest.mock('@prisma/client', () => {
    const actual = jest.requireActual('@prisma/client');
    return {
        ...actual,
        PrismaClient: jest.fn(() => ({
            $connect: jest.fn(),
            $disconnect: jest.fn(),
        })),
    };
});

// Mock the logger to avoid cluttering test output
jest.mock('../src/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

// Global setup if needed
beforeAll(async () => {
    // Any global setup
});

afterAll(async () => {
    // Any global cleanup
});

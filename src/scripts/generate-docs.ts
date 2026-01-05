
import fs from 'fs';
import path from 'path';
import { specs } from '../config/swagger';
import logger from '../utils/logger';

const outputPath = path.resolve(__dirname, '../../postman/collections/contentkosh-api.json');

// Interface for Postman Collection v2.1
interface PostmanCollection {
    info: {
        name: string;
        description?: string;
        schema: string;
    };
    item: PostmanItem[];
    variable?: any[];
}

interface PostmanItem {
    name: string;
    description?: string;
    item?: PostmanItem[]; // Folder
    request?: {
        method: string;
        header: any[];
        url: {
            raw: string;
            protocol?: string;
            host?: string[];
            path?: string[];
            query?: { key: string; value: string; description?: string; disabled?: boolean }[];
            variable?: { key: string; value: string }[];
        };
        body?: {
            mode: string;
            raw?: string;
            options?: { raw: { language: string } };
        };
        description?: string;
    };
    response?: any[];
}

// Map Swagger types to Postman
function convertSwaggerToPostman(swaggerSpecs: any): PostmanCollection {
    const info = swaggerSpecs.info || {};
    const collection: PostmanCollection = {
        info: {
            name: info.title || 'API Collection',
            description: info.description || '',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
        },
        item: [],
        variable: [
            {
                key: 'baseUrl',
                value: 'http://localhost:8080',
                type: 'string'
            },
            {
                key: 'token',
                value: '',
                type: 'string'
            }
        ]
    };

    const tags = new Set<string>();
    const paths = swaggerSpecs.paths || {};

    // organize by tags
    const requestsByTag: Record<string, PostmanItem[]> = {};

    Object.keys(paths).forEach(endpointPath => {
        const methods: any = paths[endpointPath];
        Object.keys(methods).forEach(method => {
            const details: any = methods[method];
            const tagName = details.tags && details.tags.length > 0 ? details.tags[0] : 'General';
            tags.add(tagName);

            if (!requestsByTag[tagName]) {
                requestsByTag[tagName] = [];
            }

            const postmanRequest = createPostmanRequest(endpointPath, method, details);
            requestsByTag[tagName].push(postmanRequest);

            // Create Variants for 'include'
            if (['get'].includes(method.toLowerCase())) {
                const variants = getIncludeVariants(endpointPath, tagName);
                variants.forEach(variant => {
                    const variantRequest = createPostmanRequest(endpointPath, method, details, variant);
                    if (requestsByTag[tagName]) { // Explicit check
                        requestsByTag[tagName].push(variantRequest);
                    }
                });
            }
        });
    });

    // Build Folder Structure
    Array.from(tags).sort().forEach(tag => {
        const items = requestsByTag[tag] || [];
        collection.item.push({
            name: tag,
            item: items
        });
    });

    return collection;
}

function createPostmanRequest(endpointPath: string, method: string, details: any, variant?: { suffix: string, query: any[] }): PostmanItem {
    // Convert path parameters {param} to :param
    let formattedPath = endpointPath.replace(/{([^}]+)}/g, ':$1');
    const pathSegments = formattedPath.split('/').filter(p => p.length > 0);

    const queryParams: any[] = [];

    // Add Swagger parameters to query
    if (details.parameters) {
        details.parameters.forEach((param: any) => {
            if (param.in === 'query') {
                queryParams.push({
                    key: param.name,
                    value: '',
                    description: param.description,
                    disabled: true // Disable by default
                });
            }
        });
    }

    // Add Variant parameters
    if (variant) {
        variant.query.forEach(q => {
            // Remove existing if present to override
            const idx = queryParams.findIndex(p => p.key === q.key);
            if (idx >= 0) queryParams.splice(idx, 1);

            queryParams.push({
                key: q.key,
                value: q.value,
                description: 'Inserted variant parameter',
                disabled: false
            });
        });
    }

    // Construct URL
    const urlObj = {
        raw: `{{baseUrl}}/${pathSegments.join('/')}`,
        protocol: 'http',
        host: ['{{baseUrl}}'],
        path: pathSegments,
        query: queryParams,
        variable: [] as any[] // Path variables could go here
    };

    // Auth Header
    const headers = [];
    if (details.security) {
        headers.push({
            key: 'Authorization',
            value: 'Bearer {{token}}',
            type: 'text'
        });
    }

    // Handle Body
    let body: { mode: string; raw?: string; options?: { raw: { language: string } } } | undefined = undefined;
    if (details.requestBody && details.requestBody.content && details.requestBody.content['application/json']) {
        const schemaRef = details.requestBody.content['application/json'].schema?.$ref;
        // We could resolve example body here, but for now empty object or simple example
        body = {
            mode: 'raw',
            raw: JSON.stringify(resolveSchemaExample(schemaRef), null, 2),
            options: {
                raw: { language: 'json' }
            }
        };
    }

    const requestObj: any = {
        method: method.toUpperCase(),
        header: headers,
        url: urlObj,
        description: details.description
    };
    if (body) {
        requestObj.body = body;
    }

    return {
        name: `${details.summary || endpointPath}${variant ? ` (${variant.suffix})` : ''}`,
        request: requestObj
    };
}

function getIncludeVariants(endpointPath: string, tagName: string): { suffix: string, query: any[] }[] {
    const variants: { suffix: string, query: any[] }[] = [];

    // Logic for specific endpoints
    if (endpointPath === '/api/exams' || endpointPath.startsWith('/api/exams/')) {
        variants.push({ suffix: 'with Courses', query: [{ key: 'include', value: 'courses' }] });
    }

    if (endpointPath.includes('/courses') && !endpointPath.includes('/subjects')) {
        variants.push({ suffix: 'with Subjects', query: [{ key: 'include', value: 'subjects' }] });
        variants.push({ suffix: 'with Exam', query: [{ key: 'include', value: 'exam' }] });
    }

    if (endpointPath.includes('/subjects')) {
        variants.push({ suffix: 'with Course', query: [{ key: 'include', value: 'course' }] });
    }

    if (endpointPath.includes('/batches')) {
        variants.push({ suffix: 'with Course', query: [{ key: 'include', value: 'course' }] });
        variants.push({ suffix: 'with Students', query: [{ key: 'include', value: 'students' }] });
    }

    return variants;
}

// Simple schema resolver for example bodies
function resolveSchemaExample(ref: string): any {
    if (!ref) return {};
    const schemaName = ref.split('/').pop();
    // Basic mock data based on name
    if (schemaName?.includes('Create') || schemaName?.includes('Update')) {
        if (schemaName.includes('Exam')) return { name: "Sample Exam", businessId: 1, isActive: true };
        if (schemaName.includes('Course')) return { name: "Sample Course", examId: 1, duration: "6 months" };
        if (schemaName.includes('Subject')) return { name: "Sample Subject", courseId: 1 };
        if (schemaName.includes('Batch')) return { codeName: "BATCH-01", displayName: "Morning Batch", courseId: 1, startDate: "2024-01-01", endDate: "2024-12-31" };
        if (schemaName.includes('Login')) return { email: "user@example.com", password: "password123" };
    }
    return {};
}

try {
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const postmanCollection = convertSwaggerToPostman(specs);
    const jsonContent = JSON.stringify(postmanCollection, null, 2);
    fs.writeFileSync(outputPath, jsonContent, 'utf8');

    logger.info(`Postman Collection generated successfully at: ${outputPath}`);
    console.log(`Postman Collection generated successfully at: ${outputPath}`);
} catch (error) {
    logger.error('Error generating Postman Collection:', error);
    console.error('Error generating Postman Collection:', error);
    process.exit(1);
}

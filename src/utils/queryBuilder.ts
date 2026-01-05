import { Prisma } from '@prisma/client';

export interface QueryOptions {
    select?: Record<string, boolean>;
    include?: Record<string, boolean | any>; // recursive include
    where?: Record<string, any>;
    orderBy?: Record<string, 'asc' | 'desc'>;
    skip?: number;
    take?: number;
}

export class QueryBuilder {
    static parse(query: any): QueryOptions {
        const options: QueryOptions = {};

        // 1. Fields / Select
        if (query.fields) {
            const fields = (query.fields as string).split(',');
            options.select = {};
            fields.forEach(field => {
                options.select![field.trim()] = true;
            });
        }

        // 2. Include (e.g. ?include=courses,subjects or ?include=courses.subjects)
        if (query.include) {
            if (!options.select) {
                options.include = {};
                const includes = (query.include as string).split(',');
                includes.forEach(inc => {
                    const parts = inc.trim().split('.');
                    let current = options.include;

                    parts.forEach((part, index) => {
                        if (index === parts.length - 1) {
                            current![part] = true;
                        } else {
                            if (!current![part] || current![part] === true) {
                                current![part] = { include: {} };
                            }
                            current = current![part].include;
                        }
                    });
                });
            }
        }

        // 3. Pagination
        if (query.page && query.limit) {
            const page = parseInt(query.page as string);
            const limit = parseInt(query.limit as string);
            options.skip = (page - 1) * limit;
            options.take = limit;
        }

        // 4. Sorting (e.g. ?sort=createdAt:desc or ?sort=name:asc)
        if (query.sort) {
            const [field, order] = (query.sort as string).split(':');
            if (field && (order === 'asc' || order === 'desc')) {
                options.orderBy = {
                    [field]: order
                };
            }
        }

        return options;
    }
}

export class CreateExamDto {
    name: string;
    code?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    businessId: number;

    constructor(data: any) {
        this.name = data.name;
        this.code = data.code;
        this.description = data.description;
        this.startDate = data.startDate;
        this.endDate = data.endDate;
        this.businessId = data.businessId;
    }
}

export class UpdateExamDto {
    name?: string;
    code?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    status?: 'ACTIVE' | 'INACTIVE';

    constructor(data: any) {
        this.name = data.name;
        this.code = data.code;
        this.description = data.description;
        this.startDate = data.startDate;
        this.endDate = data.endDate;
        this.status = data.status;
    }
}

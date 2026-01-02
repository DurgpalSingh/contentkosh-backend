import { UserRole } from "@prisma/client";
export { UserRole };
import { Request } from "express";



export interface LoginDto {
    email: string;
    password: string;
}


export interface IUser {
    id: number;
    email: string;
    name: string;
    businessId: number
    role: UserRole;
}

export interface AuthRequest extends Request {
    user?: IUser;
}


import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod'; // ✅ Fixed: Use ZodType instead of deprecated ZodSchema

export const validateRequest = (schema: ZodType) => {
    return (req: Request, res: Response, next: NextFunction) => {
        
        const result = schema.safeParse({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        if (!result.success) {
            const formatted = result.error.format();

            const flatErrors = Object.values(formatted)
                .flat()
                .filter(Boolean)
                .map((err: any) => err._errors)
                .flat();
            
            console.log(flatErrors);
            
            return res.status(400).json({ message: flatErrors.join(", ") });
        }

        next();
    };
};
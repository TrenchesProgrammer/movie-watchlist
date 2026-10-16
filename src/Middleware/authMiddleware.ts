import { prisma } from "../config/db"
import jwt, { JwtPayload } from "jsonwebtoken"
import { Request, Response, NextFunction } from "express"

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.jwt) {
        token = req.cookies.jwt;
    }

    if (!token) {
        return res.status(401).json({
            error: "Not authorized, no token provided",
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string);

        if (typeof decoded !== "object" || decoded === null || !("id" in decoded)) {
            return res.status(401).json({
                error: "Not authorized, invalid token",
            });
        }
  
        const user = await prisma.user.findUnique({
            where: { id: decoded.id as string },
        });

        if (!user) {
            return res.status(401).json({
                error: "Not authorized, user not found",
            });
        }
        (req as Request & { user: typeof user }).user = user;

        next();
    } catch (error) {
        return res.status(401).json({
            error: "Not authorized, invalid token",
        });
    }

}
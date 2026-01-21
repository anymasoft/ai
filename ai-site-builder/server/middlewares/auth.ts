import { NextFunction, Request, Response } from "express";

export const protect = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // For development: get userId from headers or generate a default one
        const userId = req.headers["x-user-id"] as string || "default-user";

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized User" });
        }

        req.userId = userId;
        next();
    } catch (error: any) {
        console.error("Error in protect middleware", error);
        return res.status(401).json({ message: error.message || error.code });
    }
};

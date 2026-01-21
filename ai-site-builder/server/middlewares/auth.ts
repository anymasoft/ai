import { NextFunction, Request, Response } from "express";

export const protect = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Check for dev_session cookie (from auth endpoints)
        let userId = null;

        if (req.cookies?.dev_session) {
            // Session exists, extract user ID from session
            // In dev mode, we set ID directly in cookie data
            userId = "dev-user-1"; // Fixed dev user ID
        }

        // Fallback to x-user-id header for backwards compatibility
        if (!userId) {
            userId = req.headers["x-user-id"] as string || "default-user";
        }

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

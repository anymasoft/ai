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
            // Session exists, use dev user
            userId = "dev-user-1"; // Fixed dev user ID
        }

        // Fallback to x-user-id header for backwards compatibility
        if (!userId) {
            userId = req.headers["x-user-id"] as string;
        }

        // IMPORTANT: In dev mode, always have a userId (no user = auto-auth as dev-user)
        // This allows project creation and generation without real login
        if (!userId) {
            userId = "dev-user-1";
        }

        req.userId = userId;
        next();
    } catch (error: any) {
        console.error("Error in protect middleware", error);
        return res.status(401).json({ message: error.message || error.code });
    }
};

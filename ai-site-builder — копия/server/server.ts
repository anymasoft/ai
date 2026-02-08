import express, { Request, Response } from "express";
import "dotenv/config";
import cors, { CorsOptions } from "cors";
import cookieParser from "cookie-parser";

console.log(`🔧 NODE_ENV=${process.env.NODE_ENV}`);

import { initDb } from "./lib/db.js";
import authRouter from "./routes/authRoutes.js";
import userRouter from "./routes/userRoutes.js";
import projectRouter from "./routes/projectRoutes.js";

const app = express();

const port = 3000;

const corsOption: CorsOptions = {
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
};

// LOGGING: Request/Response logger - FIRST middleware to catch all requests
app.use((req: Request, res: Response, next: Function) => {
    const startTime = Date.now();
    const hasCookie = !!(req.headers.cookie);
    const hasAuth = !!(req.headers.authorization);

    console.log(
        `[REQ] ${req.method} ${req.path} ` +
        `origin=${req.headers.origin || "none"} ` +
        `cookie=${hasCookie ? 1 : 0} auth=${hasAuth ? 1 : 0}`
    );

    // Log response when finished
    const originalSend = res.send;
    res.send = function (data: any) {
        const duration = Date.now() - startTime;
        console.log(
            `[RES] ${res.statusCode} ${req.method} ${req.path} ` +
            `duration=${duration}ms`
        );
        return originalSend.call(this, data);
    };

    next();
});

app.use(cors(corsOption));
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

// DEV AUTH: Global middleware - auto-attach dev user if not authenticated
app.use((req: Request, res: Response, next: Function) => {
    let userId = null;

    // Check dev_session cookie first
    if (req.cookies?.dev_session) {
        userId = "dev-user-1";
    }

    // Check x-user-id header
    if (!userId) {
        userId = req.headers["x-user-id"] as string;
    }

    // Fallback: always use dev-user in dev mode
    if (!userId) {
        userId = "dev-user-1";
    }

    req.userId = userId;
    console.log(`[AUTH] userId set to: ${userId}`);
    next();
});

app.get("/", (req: Request, res: Response) => {
    res.send("Server is Live!");
});

// Auth routes (no authentication required)
app.use("/api/auth", authRouter);

// Protected routes (with user context from global middleware)
app.use("/api/user", userRouter);
app.use("/api/project", projectRouter);

// Initialize database and start server
try {
    initDb();
    app.listen(port, () => {
        console.log(`✅ Server is running at http://localhost:${port}`);
    });
} catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
}

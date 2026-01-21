import express, { Request, Response } from "express";
import "dotenv/config";
import cors, { CorsOptions } from "cors";
import cookieParser from "cookie-parser";

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

app.use(cors(corsOption));
app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

app.get("/", (req: Request, res: Response) => {
    res.send("Server is Live!");
});

// Auth routes (no authentication required)
app.use("/api/auth", authRouter);

// Protected routes
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

import express, { Request, Response } from "express";
import "dotenv/config";
import cors, { CorsOptions } from "cors";

import { initDb } from "./lib/db.js";
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

app.get("/", (req: Request, res: Response) => {
    res.send("Server is Live!");
});

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

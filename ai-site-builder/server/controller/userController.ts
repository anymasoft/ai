import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import "dotenv/config";

import db from "../lib/db.js";
import { generateLanding } from "../lib/pipeline.js";

// Get the user credits
export const getUserCredits = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const user = db.prepare("SELECT credits FROM users WHERE id = ?").get(userId) as any;

        if (!user) {
            // Create user if doesn't exist
            db.prepare("INSERT INTO users (id, name, email, credits) VALUES (?, ?, ?, ?)").run(
                userId,
                "User",
                `${userId}@app.local`,
                20
            );
            return res.json({ credits: 20 });
        }

        res.json({ credits: user.credits });
    } catch (error: any) {
        console.error("Error in getUserCredits controller", error.message);
        return res.status(500).json({ message: error.message });
    }
};

// Create a new project
export const createUserProject = async (req: Request, res: Response) => {
    const userId = req.userId;
    // DEV: Log auth context for debugging
    console.log(`[CREATE_PROJECT] userId=${userId}, has_cookie=${!!req.cookies?.dev_session}`);
    try {
        if (!userId) {
            console.log("[CREATE_PROJECT] ERROR: userId is empty");
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { initial_prompt } = req.body;
        console.log(`[CREATE_PROJECT] Starting with userId=${userId}, prompt_len=${initial_prompt?.length}`);

        // Ensure user exists
        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
        if (!user) {
            db.prepare("INSERT INTO users (id, name, email, credits) VALUES (?, ?, ?, ?)").run(
                userId,
                "User",
                `${userId}@app.local`,
                20
            );
        }

        const userCredits = user?.credits || 20;

        if (userCredits < 5) {
            return res.status(403).json({ message: "Add more credits to create a project" });
        }

        // Create a new project
        const projectId = uuidv4();
        const projectName = initial_prompt.length > 50 ? initial_prompt.substring(0, 47) + "..." : initial_prompt;

        db.prepare(
            "INSERT INTO projects (id, user_id, name, initial_prompt, current_code) VALUES (?, ?, ?, ?, ?)"
        ).run(projectId, userId, projectName, initial_prompt, "");

        // Update user credits
        db.prepare("UPDATE users SET credits = credits - 5 WHERE id = ?").run(userId);

        // Add conversation
        db.prepare("INSERT INTO conversations (id, project_id, role, content) VALUES (?, ?, ?, ?)").run(
            uuidv4(),
            projectId,
            "user",
            initial_prompt
        );

        res.json({ projectId });

        // Определить режим: highQuality через query param ?hq=true
        const forceHQ = req.query.hq === "true" || undefined;

        // Generate website asynchronously
        (async () => {
            try {
                const result = await generateLanding(initial_prompt, forceHQ);

                db.prepare("INSERT INTO conversations (id, project_id, role, content) VALUES (?, ?, ?, ?)").run(
                    uuidv4(),
                    projectId,
                    "assistant",
                    `Промпт улучшен (режим: ${result.mode}):\n\n"${result.enhancedPrompt}"`
                );

                if (!result.html) {
                    db.prepare("INSERT INTO conversations (id, project_id, role, content) VALUES (?, ?, ?, ?)").run(
                        uuidv4(), projectId, "assistant",
                        "Не удалось сгенерировать код, попробуйте ещё раз."
                    );
                    db.prepare("UPDATE users SET credits = credits + 5 WHERE id = ?").run(userId);
                    return;
                }

                // Логируем результат валидации
                if (result.validation.warnings.length > 0) {
                    console.log(`[PIPELINE] Final warnings: ${result.validation.warnings.join("; ")}`);
                }

                const versionId = uuidv4();
                db.prepare("INSERT INTO versions (id, project_id, code, description) VALUES (?, ?, ?, ?)").run(
                    versionId, projectId, result.html,
                    `Initial version (${result.mode}${result.plan ? ", " + Object.keys(result.plan).length + " sections" : ""})`
                );

                db.prepare("INSERT INTO conversations (id, project_id, role, content) VALUES (?, ?, ?, ?)").run(
                    uuidv4(), projectId, "assistant",
                    "Сайт создан! Вы можете просмотреть его и запросить изменения."
                );

                db.prepare("UPDATE projects SET current_code = ? WHERE id = ?").run(result.html, projectId);
            } catch (error: any) {
                console.error("Error in project generation:", error);
                db.prepare("UPDATE users SET credits = credits + 5 WHERE id = ?").run(userId);
            }
        })();
    } catch (error: any) {
        console.error("Error in createUserProject controller", error.message);
        return res.status(500).json({ message: error.message });
    }
};

// Get a single user project
export const getUserProject = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { projectId } = req.params;

        if (!projectId) {
            return res.status(400).json({ message: "Project ID is required" });
        }

        const project = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, userId) as any;

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const conversations = db.prepare("SELECT * FROM conversations WHERE project_id = ? ORDER BY timestamp ASC").all(projectId);
        const versions = db.prepare("SELECT * FROM versions WHERE project_id = ? ORDER BY timestamp ASC").all(projectId);

        res.json({
            project: {
                ...project,
                conversation: conversations,
                versions: versions,
            }
        });
    } catch (error: any) {
        console.error("Error in getUserProject controller", error);
        return res.status(500).json({ message: error.message });
    }
};

// Get all user projects
export const getUserProjects = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const projects = db.prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC").all(userId);

        res.json({ projects });
    } catch (error: any) {
        console.error("Error in getUserProjects controller", error);
        return res.status(500).json({ message: error.message });
    }
};

// Toggle project publish
export const togglePublish = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { projectId } = req.params;

        if (!projectId) {
            return res.status(400).json({ message: "Project ID is required" });
        }

        const project = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, userId) as any;

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const newPublishState = project.is_published === 0 ? 1 : 0;
        db.prepare("UPDATE projects SET is_published = ? WHERE id = ?").run(newPublishState, projectId);

        res.json({
            message: newPublishState === 0 ? "Project Unpublished" : "Project Published",
        });
    } catch (error: any) {
        console.error("Error in togglePublish controller", error);
        return res.status(500).json({ message: error.message });
    }
};

// To purchase credits (simplified - no Stripe)
export const purchaseCredits = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { planId } = req.body;

        const plans: Record<string, { credits: number }> = {
            basic: { credits: 100 },
            pro: { credits: 400 },
            enterprise: { credits: 1000 },
        };

        const plan = plans[planId];
        if (!plan) {
            return res.status(400).json({ message: "Plan not found" });
        }

        // For development: just add credits directly
        db.prepare("UPDATE users SET credits = credits + ? WHERE id = ?").run(plan.credits, userId);

        res.json({ message: `${plan.credits} credits added!` });
    } catch (error: any) {
        console.error("Error in purchaseCredits controller", error);
        return res.status(500).json({ message: error.message });
    }
};

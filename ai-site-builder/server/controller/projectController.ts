import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

import db from "../lib/db.js";
import { callAI } from "../config/ai.js";
import { SYSTEM_PROMPT_REVISE } from "../prompts/designSystem.js";

// To make revisions
export const makeRevision = async (req: Request, res: Response) => {
    const userId = req.userId;

    try {
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { projectId } = req.params;
        const { message } = req.body;

        const user = db.prepare("SELECT credits FROM users WHERE id = ?").get(userId) as any;

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.credits < 5) {
            return res.status(403).json({ message: "Add more credits to make changes" });
        }

        if (!message || message.trim() === "") {
            return res.status(400).json({ message: "Please enter a valid prompt" });
        }

        const currentProject = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, userId) as any;

        if (!currentProject) {
            return res.status(404).json({ message: "Project not found" });
        }

        db.prepare("INSERT INTO conversations (id, project_id, role, content) VALUES (?, ?, ?, ?)").run(
            uuidv4(),
            projectId,
            "user",
            message
        );

        db.prepare("UPDATE users SET credits = credits - 5 WHERE id = ?").run(userId);

        // Enhance user prompt
        const enhancedPrompt = await callAI({
            system: `You are a prompt enhancement specialist. The user wants to make changes to their website. Rewrite their request to be more specific and actionable.

CRITICAL RULES:
- Return ONLY plain text description, 1-2 sentences max.
- NEVER generate HTML, CSS, JavaScript or any code.
- NEVER include code tags, backticks, or markup.
- Your output is a TEXT instruction for a developer, NOT code.

Enhance by being specific about elements, colors, spacing, sizes, and desired outcome.
Return ONLY the enhanced text request. No code. No HTML.`,
            user: `User's request: "${message}"`,
            maxTokens: 512,
            temperature: 0.5,
            format: "text",
        }) || message;

        db.prepare("INSERT INTO conversations (id, project_id, role, content) VALUES (?, ?, ?, ?)").run(
            uuidv4(),
            projectId,
            "assistant",
            `I have enhanced your prompt to:\n\n"${enhancedPrompt}"`
        );

        db.prepare("INSERT INTO conversations (id, project_id, role, content) VALUES (?, ?, ?, ?)").run(
            uuidv4(),
            projectId,
            "assistant",
            "Now making changes to your website..."
        );

        // Generate website code
        const code = await callAI({
            system: SYSTEM_PROMPT_REVISE,
            user: `CURRENT HTML CODE:\n${currentProject.current_code}\n\nREQUESTED CHANGES:\n${enhancedPrompt}`,
            format: "html",
        });

        if (!code) {
            db.prepare("INSERT INTO conversations (id, project_id, role, content) VALUES (?, ?, ?, ?)").run(
                uuidv4(),
                projectId,
                "assistant",
                "Unable to generate code, please try again.."
            );

            db.prepare("UPDATE users SET credits = credits + 5 WHERE id = ?").run(userId);

            return;
        }

        const versionId = uuidv4();
        db.prepare("INSERT INTO versions (id, project_id, code, description) VALUES (?, ?, ?, ?)").run(
            versionId,
            projectId,
            code,
            "Changes made"
        );

        db.prepare("INSERT INTO conversations (id, project_id, role, content) VALUES (?, ?, ?, ?)").run(
            uuidv4(),
            projectId,
            "assistant",
            "I have made changes to your website! You can now preview it."
        );

        db.prepare("UPDATE projects SET current_code = ? WHERE id = ?").run(code, projectId);

        res.json({ message: "Changes made successfully" });
    } catch (error: any) {
        db.prepare("UPDATE users SET credits = credits + 5 WHERE id = ?").run(userId);

        console.error("Error in makeRevision controller", error.message || error.code);

        return res.status(500).json({ message: error.message || error.code });
    }
};

// Rollback to specific version
export const rollbackToVersion = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { projectId, versionId } = req.params;
        if (!projectId || !versionId) {
            return res.status(400).json({ message: "Missing project ID or version ID" });
        }

        const project = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, userId) as any;

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const version = db.prepare("SELECT * FROM versions WHERE id = ? AND project_id = ?").get(versionId, projectId) as any;

        if (!version) {
            return res.status(404).json({ message: "Version not found" });
        }

        db.prepare("UPDATE projects SET current_code = ? WHERE id = ?").run(version.code, projectId);

        db.prepare("INSERT INTO conversations (id, project_id, role, content) VALUES (?, ?, ?, ?)").run(
            uuidv4(),
            projectId,
            "assistant",
            "I have rolled back your website to the specified version. You can now preview it."
        );

        res.json({ message: "Version rolled back successfully" });
    } catch (error: any) {
        console.error("Error in rollbackToVersion controller", error.message || error.code);

        return res.status(500).json({ message: error.message || error.code });
    }
};

// Apply specific version (alternative to rollback - for ad-blocker compatibility)
export const applyVersion = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { projectId, versionId } = req.body;
        if (!projectId || !versionId) {
            return res.status(400).json({ message: "Missing project ID or version ID" });
        }

        console.log(`[APPLY_VERSION] projectId=${projectId}, versionId=${versionId}, userId=${userId}`);

        const project = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, userId) as any;

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const version = db.prepare("SELECT * FROM versions WHERE id = ? AND project_id = ?").get(versionId, projectId) as any;

        if (!version) {
            return res.status(404).json({ message: "Version not found" });
        }

        db.prepare("UPDATE projects SET current_code = ? WHERE id = ?").run(version.code, projectId);

        db.prepare("INSERT INTO conversations (id, project_id, role, content) VALUES (?, ?, ?, ?)").run(
            uuidv4(),
            projectId,
            "assistant",
            "I have applied the version to your website. You can now preview it."
        );

        res.json({ message: "Version applied successfully" });
    } catch (error: any) {
        console.error("Error in applyVersion controller", error.message || error.code);

        return res.status(500).json({ message: error.message || error.code });
    }
};

// Delete a project
export const deleteProject = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { projectId } = req.params;
        if (!projectId) {
            return res.status(400).json({ message: "Missing project ID" });
        }

        const project = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, userId) as any;

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        // Delete conversations and versions first
        db.prepare("DELETE FROM conversations WHERE project_id = ?").run(projectId);
        db.prepare("DELETE FROM versions WHERE project_id = ?").run(projectId);
        db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);

        res.json({ message: "Project deleted successfully" });
    } catch (error: any) {
        console.error("Error in deleteProject controller", error.message || error.code);

        return res.status(500).json({ message: error.message || error.code });
    }
};

// Getting project code for preview
export const getProjectPreview = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { projectId } = req.params;
        if (!projectId) {
            return res.status(400).json({ message: "Missing project ID" });
        }

        const project = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, userId) as any;

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const versions = db.prepare("SELECT * FROM versions WHERE project_id = ?").all(projectId);

        res.json({
            project: {
                ...project,
                versions: versions,
            }
        });
    } catch (error: any) {
        console.error("Error in getProjectPreview controller", error.message || error.code);

        return res.status(500).json({ message: error.message || error.code });
    }
};

// Get published projects
export const getPublishedProjects = async (req: Request, res: Response) => {
    try {
        const projects = db.prepare("SELECT * FROM projects WHERE is_published = 1").all();

        res.json({ projects });
    } catch (error: any) {
        console.error("Error in getPublishedProjects controller", error.message || error.code);

        return res.status(500).json({ message: error.message || error.code });
    }
};

// Get a single project by id
export const getProjectById = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        if (!projectId) {
            return res.status(400).json({ message: "Missing project ID" });
        }

        const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as any;

        if (!project || project.is_published === 0 || !project?.current_code) {
            return res.status(404).json({ message: "Project not found" });
        }

        res.json({ code: project.current_code });
    } catch (error: any) {
        console.error("Error in getProjectById controller", error.message || error.code);

        return res.status(500).json({ message: error.message || error.code });
    }
};

// Save project code
export const saveProjectCode = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { projectId } = req.params;
        if (!projectId) {
            return res.status(400).json({ message: "Missing project ID" });
        }

        const { code } = req.body;
        if (!code) {
            return res.status(400).json({ message: "Missing code" });
        }

        const project = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, userId) as any;

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        db.prepare("UPDATE projects SET current_code = ? WHERE id = ?").run(code, projectId);

        res.json({ message: "Code saved successfully" });
    } catch (error: any) {
        console.error("Error in saveProjectCode controller", error.message || error.code);

        return res.status(500).json({ message: error.message || error.code });
    }
};

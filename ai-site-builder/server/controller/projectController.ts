import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

import db from "../lib/db.js";
import openai from "../config/openai.js";

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
        const promptEnhanceResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `
                    You are a prompt enhancement specialist. The user wants to make changes to their website. Enhance their request to be more specific and actionable for a web developer.

                    Enhance this by:
                    1. Being specific about what elements to change
                    2. Mentioning design details (colors, spacing, sizes)
                    3. Clarifying the desired outcome
                    4. Using clear technical terms

                    Return ONLY the enhanced request, nothing else. Keep it concise (1-2 sentences).`,
                },
                {
                    role: "user",
                    content: `User's request: "${message}"`,
                },
            ],
        });

        const enhancedPrompt = promptEnhanceResponse.choices[0].message.content || message;

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
        const codeGenerationResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `
                    You are an expert web developer.

                    CRITICAL REQUIREMENTS:
                    - Return ONLY the complete updated HTML code with the requested changes.
                    - Use Tailwind CSS for ALL styling (NO custom CSS).
                    - Use Tailwind utility classes for all styling changes.
                    - Include all JavaScript in <script> tags before closing </body>
                    - Make sure it's a complete, standalone HTML document with Tailwind CSS
                    - Return the HTML Code Only, nothing else

                    Apply the requested changes while maintaining the Tailwind CSS styling approach.`,
                },
                {
                    role: "user",
                    content: `
                    Here is the current website code: "${currentProject.current_code}", The user want these changes: "${enhancedPrompt}"`,
                },
            ],
        });

        const code = codeGenerationResponse.choices[0].message.content || "";

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

        const cleanCode = code
            .replace(/```[a-z]*\n?/gi, "")
            .replace(/```$/g, "")
            .trim();

        const versionId = uuidv4();
        db.prepare("INSERT INTO versions (id, project_id, code, description) VALUES (?, ?, ?, ?)").run(
            versionId,
            projectId,
            cleanCode,
            "Changes made"
        );

        db.prepare("INSERT INTO conversations (id, project_id, role, content) VALUES (?, ?, ?, ?)").run(
            uuidv4(),
            projectId,
            "assistant",
            "I have made changes to your website! You can now preview it."
        );

        db.prepare("UPDATE projects SET current_code = ? WHERE id = ?").run(cleanCode, projectId);

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

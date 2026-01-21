import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import "dotenv/config";

import db from "../lib/db.js";
import openai from "../config/openai.js";

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
    try {
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { initial_prompt } = req.body;

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

        // Generate website asynchronously
        (async () => {
            try {
                // Enhance user prompt
                const promptEnhanceResponse = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: `
                    You are a prompt enhancement specialist. Take the user's website request and expand it into a detailed, comprehensive prompt that will help create the best possible website.

                    Enhance this prompt by:
                    1. Adding specific design details (layout, color scheme, typography)
                    2. Specifying key sections and features
                    3. Describing the user experience and interactions
                    4. Including modern web design best practices
                    5. Mentioning responsive design requirements
                    6. Adding any missing but important elements

                    Return ONLY the enhanced prompt, nothing else. Make it detailed but concise (2-3 paragraphs max).`,
                        },
                        {
                            role: "user",
                            content: initial_prompt,
                        },
                    ],
                });

                const enhancedPrompt = promptEnhanceResponse.choices[0].message.content;

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
                    "Now generating your website..."
                );

                // Generate website code
                const codeGenerationResponse = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: `
                    You are an expert web developer. Create a complete, production-ready, single-page website based on this request: "${enhancedPrompt}"

                    CRITICAL REQUIREMENTS:
                    - You MUST output valid HTML ONLY.
                    - Use Tailwind CSS for ALL styling
                    - Include this EXACT script in the <head>: <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
                    - Use Tailwind utility classes extensively for styling, animations, and responsiveness
                    - Make it fully functional and interactive with JavaScript in <script> tag before closing </body>
                    - Use modern, beautiful design with great UX using Tailwind classes
                    - Make it responsive using Tailwind responsive classes (sm:, md:, lg:, xl:)
                    - Use Tailwind animations and transitions (animate-*, transition-*)
                    - Include all necessary meta tags
                    - Use Google Fonts CDN if needed for custom fonts
                    - Use placeholder images from https://placehold.co/600x400
                    - Use Tailwind gradient classes for beautiful backgrounds
                    - Make sure all buttons, cards, and components use Tailwind styling

                    CRITICAL HARD RULES:
                    1. You MUST put ALL output ONLY into message.content.
                    2. You MUST NOT place anything in "reasoning", "analysis", "reasoning_details", or any hidden fields.
                    3. You MUST NOT include internal thoughts, explanations, analysis, comments, or markdown.
                    4. Do NOT include markdown, explanations, notes, or code fences.

                    The HTML should be complete and ready to render as-is with Tailwind CSS.`,
                        },
                        {
                            role: "user",
                            content: enhancedPrompt || "",
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

                // Create version for the project
                const versionId = uuidv4();
                db.prepare("INSERT INTO versions (id, project_id, code, description) VALUES (?, ?, ?, ?)").run(
                    versionId,
                    projectId,
                    cleanCode,
                    "Initial version"
                );

                db.prepare("INSERT INTO conversations (id, project_id, role, content) VALUES (?, ?, ?, ?)").run(
                    uuidv4(),
                    projectId,
                    "assistant",
                    "I have created your website! You can now preview it and request any changes."
                );

                db.prepare("UPDATE projects SET current_code = ? WHERE id = ?").run(cleanCode, projectId);
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

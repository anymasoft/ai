import express from "express";

import { protect } from "../middlewares/auth.js";
import {
    applyVersion,
    deleteProject,
    getProjectById,
    getProjectPreview,
    getPublishedProjects,
    makeRevision,
    saveProjectCode,
} from "../controller/projectController.js";

const projectRouter = express.Router();

projectRouter.post("/revision/:projectId", protect, makeRevision);
projectRouter.put("/save/:projectId", protect, saveProjectCode);
projectRouter.post("/apply-version", protect, applyVersion);
projectRouter.delete("/delete/:projectId", protect, deleteProject);
projectRouter.get("/preview/:projectId", protect, getProjectPreview);
projectRouter.get("/published", getPublishedProjects);
projectRouter.get("/published/:projectId", getProjectById);

export default projectRouter;

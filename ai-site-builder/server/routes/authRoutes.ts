import express from "express";
import { signUp, signIn, getSession, signOut } from "../controller/authController.js";

const authRouter = express.Router();

// Auth endpoints
authRouter.post("/sign-up", signUp);
authRouter.post("/sign-in", signIn);
authRouter.get("/session", getSession);
authRouter.post("/sign-out", signOut);

// Better Auth compatibility endpoints (можно через этот путь)
authRouter.post("/signup", signUp);
authRouter.post("/signin", signIn);

export default authRouter;

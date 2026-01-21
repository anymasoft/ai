import express from "express";
import { signUp, signIn, getSession, signOut } from "../controller/authController.js";

const authRouter = express.Router();

// Standard auth endpoints
authRouter.post("/sign-up", signUp);
authRouter.post("/sign-in", signIn);
authRouter.get("/session", getSession);
authRouter.post("/sign-out", signOut);

// Better Auth compatibility endpoints (lowercase)
authRouter.post("/signup", signUp);
authRouter.post("/signin", signIn);

// Better Auth callback format (most common)
authRouter.post("/callback/credentials", signIn);
authRouter.post("/callback/signup", signUp);

// Handle all auth paths that might be called
authRouter.get("/", (req, res) => {
    res.json({ message: "Auth API ready" });
});

export default authRouter;

import { Router } from "express";
import type { Request, Response } from "express";
import { authService } from "../services/authService";
import passport from "../config/passport";
export const authRoutes = Router();

// POST /api/auth/register
authRoutes.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }
    const result = await authService.register(email, password, name);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/login
authRoutes.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

// GET /api/auth/github → inicia flujo OAuth
authRoutes.get(
  "/github",
  passport.authenticate("github", { session: false })
);

// GET /api/auth/github/callback → callback de GitHub
authRoutes.get(
  "/github/callback",
  passport.authenticate("github", { session: false, failureRedirect: "/api/auth/github" }),
  (req: Request, res: Response) => {
    const { token } = req.user as any;
    res.redirect(`nts://auth?token=${token}`);
  }
);

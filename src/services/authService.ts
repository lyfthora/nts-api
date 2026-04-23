import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database";
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const SALT_ROUNDS = 10;
export const authService = {
//register
  async register(email: string, password: string, name?: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error("Email already registered");
    }
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name },
    });
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });
    return { token, user: { id: user.id, email: user.email, name: user.name } };
  },

//login
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error("Invalid email or password");
    }
    if (!user.password) {
      throw new Error(`This account uses ${user.provider} login`);
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new Error("Invalid email or password");
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });
    return { token, user: { id: user.id, email: user.email, name: user.name } };
  },

  //oauth
async findOrCreateOAuthUser(profile: {
    email: string;
    name: string | null;
    provider: string;
    providerId: string;
  }) {
    let user = await prisma.user.findFirst({
      where: { provider: profile.provider, providerId: profile.providerId },
    });
    if (!user) {
      const existingByEmail = await prisma.user.findUnique({
        where: { email: profile.email },
      });
      if (existingByEmail) {
        user = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: { provider: profile.provider, providerId: profile.providerId },
        });
      } else {
        user = await prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            provider: profile.provider,
            providerId: profile.providerId,
          },
        });
      }
    }
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });
    return { token, user: { id: user.id, email: user.email, name: user.name } };
  },

  verifyToken(token: string): { userId: number; email: string } {
    return jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
  },
};

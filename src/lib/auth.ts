import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "./db";
import { sendMail } from "./mail";
export const auth = betterAuth({
  appName: "Petish",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  advanced: { database: { generateId: "uuid" } },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) =>
      sendMail(user.email, "Reset your Petish password", url),
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) =>
      sendMail(user.email, "Verify your Petish email", url),
  },
  session: {
    cookieCache: { enabled: false },
    expiresIn: 60 * 60 * 24 * 7,
    freshAge: 60 * 10,
  },
  rateLimit: { enabled: true, window: 60, max: 30 },
});

import type { Context } from "hono";
import { getCurrentUser, serializeUser } from "./session.js";

export async function requireCurrentUser(c: Context) {
  const user = await getCurrentUser(c);

  if (!user) {
    return {
      response: c.json({ message: "Unauthorized" }, 401),
      user: null,
    } as const;
  }

  return {
    response: null,
    user,
    serializedUser: serializeUser(user),
  } as const;
}

import { type Request, type Response, type NextFunction } from "express";
import { auth } from "../utils/auth.js";
import { fromNodeHeaders } from "better-auth/node";
import { ApiError } from "../utils/ApiError.js";

export interface AuthRequest extends Request {
  userId?: string;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      throw new ApiError(401, "Unauthorized");
    }

    req.userId = session.user.id;
    next();
  } catch (error) {
    next(error);
  }
};

import { Request, Response, NextFunction } from "express";
import { requireAuth } from "./requireAuth";
import { apiKeyMiddleware } from "./apiKey";

export async function requireAuthOrApiKey(req: Request, res: Response, next: NextFunction) {
  if (req.headers["x-api-key"]) {
    return apiKeyMiddleware(req, res, next);
  }
  return requireAuth(req, res, next);
}

import { Request, Response, NextFunction } from "express";

export function authFromQueryToken(req: Request, _res: Response, next: NextFunction) {
  const token = String(req.query.token ?? "").trim();
  console.log("Hey i got the request")
  if (!req.headers.authorization && token) {
    req.headers.authorization = `Bearer ${token}`;
  }

  next();
}

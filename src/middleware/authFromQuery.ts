import { Request, Response, NextFunction } from "express";

export function authFromQueryToken(req: Request, _res: Response, next: NextFunction) {
  const token = String(req.query.token ?? "").trim();
  if (!req.headers.authorization && token) {
    req.headers.authorization = `Bearer ${token}`;
  }
  console.log("Auth from query token middleware called", token)  

  next();
}

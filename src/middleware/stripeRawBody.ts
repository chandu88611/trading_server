import bodyParser from "body-parser";
import { RequestHandler } from "express";

export const stripeRawBody: RequestHandler = bodyParser.raw({
  type: "application/json",
});

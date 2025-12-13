// import { HttpStatusCode  _} from './enums/http-status-code.enum';
import { Response, Request, NextFunction } from "express";
import { ErrorMessage, HttpStatusCode } from "./constants";
// import { ErrorMessage } from './enums/custom-error-message.enum';

type AppError = Partial<{
  data: unknown;
  statusCode: number;
  message: string;
  appGroupName: string;
  isUpdate: boolean;
}> &
  Error;

class ErrorResponder {
  static respond(res: Response, err: AppError) {
    const statusCode = err.statusCode ?? HttpStatusCode._INTERNAL_SERVER_ERROR;
    const message = err.message ?? ErrorMessage.INTERNAL_SERVER_ERROR;

    try {
      if (err.data !== undefined) {
        res.status(statusCode).json({ message, data: err.data });
      } else {
        res.status(statusCode).json({ message });
      }
    } catch (e) {
      // Last-resort fallback
      // eslint-disable-next-line no-console
      console.error("ErrorResponder failed", e);
      res
        .status(HttpStatusCode._INTERNAL_SERVER_ERROR)
        .json({ message: ErrorMessage.INTERNAL_SERVER_ERROR });
    }
  }
}

/**
 * Decorator factory for controller methods to catch errors and produce HTTP responses.
 * Usage:
 *   @ControllerError()
 *   async myMethod(req, res) { ... }
 */
export function ControllerError(): MethodDecorator {
  return (_target, _key, descriptor: PropertyDescriptor) => {
    const original = descriptor.value;
    if (typeof original !== "function") return descriptor;

    descriptor.value = async function (
      req: Request,
      res: Response,
      next?: NextFunction
    ) {
      try {
        // Support both (req,res) and (req,res,next)
        return await original.apply(this, [req, res, next]);
      } catch (rawErr: any) {
        // enrich known app context errors
        if (rawErr?.appGroupName) {
          const operation = rawErr.isUpdate ? "update" : "create";
          rawErr.message = `Failed to ${operation} app group "${rawErr.appGroupName}"`;
          rawErr.data = rawErr.appGroupName;
          rawErr.statusCode =
            rawErr.statusCode ?? HttpStatusCode._INTERNAL_SERVER_ERROR;
        }

        // eslint-disable-next-line no-console
        console.error("Controller error caught", rawErr);
        ErrorResponder.respond(res, rawErr);
      }
    };

    return descriptor;
  };
}

/**
 * Express middleware wrapper to use the same error responder for routes defined with async handlers
 * Example: app.get('/x', errorHandler(async (req,res)=>{...}))
 */
export function errorHandler(
  fn: (req: Request, res: Response, next?: NextFunction) => Promise<any>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (err: any) {
      // same enrichment
      if (err?.appGroupName) {
        const operation = err.isUpdate ? "update" : "create";
        err.message = `Failed to ${operation} app group "${err.appGroupName}"`;
        err.data = err.appGroupName;
        err.statusCode =
          err.statusCode ?? HttpStatusCode._INTERNAL_SERVER_ERROR;
      }
      // eslint-disable-next-line no-console
      console.error("Middleware caught error", err);
      ErrorResponder.respond(res, err);
    }
  };
}

export default {
  ControllerError,
  errorHandler,
  ErrorResponder,
};

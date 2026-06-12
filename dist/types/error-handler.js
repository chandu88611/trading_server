"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ControllerError = ControllerError;
exports.errorHandler = errorHandler;
const constants_1 = require("./constants");
class ErrorResponder {
    static respond(res, err) {
        const statusCode = err.statusCode ?? constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR;
        const message = err.message ?? constants_1.ErrorMessage.INTERNAL_SERVER_ERROR;
        try {
            if (err.data !== undefined) {
                res.status(statusCode).json({ message, data: err.data });
            }
            else {
                res.status(statusCode).json({ message });
            }
        }
        catch (e) {
            // Last-resort fallback
            // eslint-disable-next-line no-console
            console.error("ErrorResponder failed", e);
            res
                .status(constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR)
                .json({ message: constants_1.ErrorMessage.INTERNAL_SERVER_ERROR });
        }
    }
}
async function logErrorEvent(req, err) {
    try {
        const statusCode = err.statusCode ?? constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR;
        const { default: AppDataSource } = await Promise.resolve().then(() => __importStar(require("../db/data-source")));
        if (!AppDataSource.isInitialized)
            return;
        await AppDataSource.query(`
      INSERT INTO error_events(service, severity, message, stack, route, method, actor_user_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      `, [
            "trading_server",
            statusCode >= 500 ? "error" : "warn",
            String(err.message ?? constants_1.ErrorMessage.INTERNAL_SERVER_ERROR),
            err.stack ?? null,
            req.originalUrl ?? req.path,
            req.method,
            Number(req.auth?.userId) || null,
            JSON.stringify({ statusCode, data: err.data ?? null }),
        ]);
    }
    catch (_error) {
        // Error logging is diagnostic only; never mask the original controller response.
    }
}
/**
 * Decorator factory for controller methods to catch errors and produce HTTP responses.
 * Usage:
 *   @ControllerError()
 *   async myMethod(req, res) { ... }
 */
function ControllerError() {
    return (_target, _key, descriptor) => {
        const original = descriptor.value;
        if (typeof original !== "function")
            return descriptor;
        descriptor.value = async function (req, res, next) {
            try {
                // Support both (req,res) and (req,res,next)
                return await original.apply(this, [req, res, next]);
            }
            catch (rawErr) {
                // enrich known app context errors
                if (rawErr?.appGroupName) {
                    const operation = rawErr.isUpdate ? "update" : "create";
                    rawErr.message = `Failed to ${operation} app group "${rawErr.appGroupName}"`;
                    rawErr.data = rawErr.appGroupName;
                    rawErr.statusCode =
                        rawErr.statusCode ?? constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR;
                }
                // eslint-disable-next-line no-console
                console.error("Controller error caught", rawErr);
                void logErrorEvent(req, rawErr);
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
function errorHandler(fn) {
    return async (req, res, next) => {
        try {
            await fn(req, res, next);
        }
        catch (err) {
            // same enrichment
            if (err?.appGroupName) {
                const operation = err.isUpdate ? "update" : "create";
                err.message = `Failed to ${operation} app group "${err.appGroupName}"`;
                err.data = err.appGroupName;
                err.statusCode =
                    err.statusCode ?? constants_1.HttpStatusCode._INTERNAL_SERVER_ERROR;
            }
            // eslint-disable-next-line no-console
            console.error("Middleware caught error", err);
            void logErrorEvent(req, err);
            ErrorResponder.respond(res, err);
        }
    };
}
exports.default = {
    ControllerError,
    errorHandler,
    ErrorResponder,
};

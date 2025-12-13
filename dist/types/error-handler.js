"use strict";
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
            ErrorResponder.respond(res, err);
        }
    };
}
exports.default = {
    ControllerError,
    errorHandler,
    ErrorResponder,
};

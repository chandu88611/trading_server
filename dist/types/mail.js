"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMailEnabled = exports.mailTransporter = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
const smtpConfigured = !!(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
exports.mailTransporter = smtpConfigured
    ? nodemailer_1.default.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: SMTP_SECURE === "true",
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
    : nodemailer_1.default.createTransport({ jsonTransport: true }); // silent no-op
exports.isMailEnabled = smtpConfigured;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendUserVerificationEmail = sendUserVerificationEmail;
const email_service_1 = require("../../../types/email.service");
async function sendUserVerificationEmail(email, token) {
    await (0, email_service_1.sendVerificationEmail)({ email, token });
}

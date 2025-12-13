"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BULL_QUEUE = exports.ErrorMessage = exports.HttpStatusCode = exports.AuthErrorCode = void 0;
var AuthErrorCode;
(function (AuthErrorCode) {
    AuthErrorCode["_USER_NOT_FOUND"] = "A_01";
    AuthErrorCode["_INVALID_CREDENTIALS"] = "A_02";
    AuthErrorCode["_USER_ALREADY_EXISTS"] = "A_03";
    AuthErrorCode["_MISSING_REQUIRED_FIELDS"] = "A_04";
})(AuthErrorCode || (exports.AuthErrorCode = AuthErrorCode = {}));
// export enum GeneralErrorCode {
// _INTERNAL_SERVER_ERRORs = 'GE_01',
// }
var HttpStatusCode;
(function (HttpStatusCode) {
    HttpStatusCode[HttpStatusCode["_SUCCESS"] = 200] = "_SUCCESS";
    HttpStatusCode[HttpStatusCode["_INTERNAL_SERVER_ERROR"] = 500] = "_INTERNAL_SERVER_ERROR";
    HttpStatusCode[HttpStatusCode["_UNKNOWN_PARAMETERS_VALUE"] = 406] = "_UNKNOWN_PARAMETERS_VALUE";
    HttpStatusCode[HttpStatusCode["_APPLICATION_COMMUNICATION_FAILURE"] = 503] = "_APPLICATION_COMMUNICATION_FAILURE";
    HttpStatusCode[HttpStatusCode["_BAD_REQUEST"] = 400] = "_BAD_REQUEST";
    HttpStatusCode[HttpStatusCode["_UNAUTHORISED"] = 401] = "_UNAUTHORISED";
    HttpStatusCode[HttpStatusCode["_NOT_FOUND"] = 404] = "_NOT_FOUND";
    HttpStatusCode[HttpStatusCode["_CONFLICT"] = 409] = "_CONFLICT";
    HttpStatusCode[HttpStatusCode["_BAD_GATEWAY"] = 502] = "_BAD_GATEWAY";
    HttpStatusCode[HttpStatusCode["_PRECONDITION_ERROR"] = 412] = "_PRECONDITION_ERROR";
    HttpStatusCode["ECONNREFUSED"] = "ECONNREFUSED";
})(HttpStatusCode || (exports.HttpStatusCode = HttpStatusCode = {}));
var ErrorMessage;
(function (ErrorMessage) {
    ErrorMessage["DATA_NOT_FOUND"] = "DATA_NOT_FOUND";
    ErrorMessage["INTERNAL_SERVER_ERROR"] = "INTERNAL_SERVER_ERROR";
    ErrorMessage["BAD_REQUEST"] = "BAD_REQUEST";
    ErrorMessage["_Duplicate_File"] = "file all ready exists!";
    ErrorMessage["_Bridge_Already_Exists"] = "Bridge Already Exists";
    ErrorMessage["_Invalid_link_speed_interfaces"] = "Invalid Link Speed Interfaces";
    ErrorMessage["_Already_interfaces_are_attached_to_bridge"] = "Already interfaces are attached to bridge";
    ErrorMessage["_Already_interfaces_are_in_L3_mode"] = "Already interfaces are in L3 Mode";
    ErrorMessage["_Bridge_Not_Exists"] = "Bridge not exists";
    ErrorMessage["_App_Group_Already_Exists"] = "App Group already exists";
    ErrorMessage["_Error_while_deleting"] = "Error while deleting ";
    ErrorMessage["_Not_exists"] = "Not Exists";
    ErrorMessage["_Not_Allowed"] = "Not Allowed ";
    ErrorMessage["_Already_Exists"] = "Already Exists";
})(ErrorMessage || (exports.ErrorMessage = ErrorMessage = {}));
var BULL_QUEUE;
(function (BULL_QUEUE) {
    BULL_QUEUE["SCHEDULER_QUEUE"] = "SCHEDULER_QUEUE";
})(BULL_QUEUE || (exports.BULL_QUEUE = BULL_QUEUE = {}));

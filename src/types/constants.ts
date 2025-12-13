export enum AuthErrorCode {
  _USER_NOT_FOUND = 'A_01',
  _INVALID_CREDENTIALS = 'A_02',
  _USER_ALREADY_EXISTS = 'A_03',
  _MISSING_REQUIRED_FIELDS = 'A_04',
}
// export enum GeneralErrorCode {
// _INTERNAL_SERVER_ERRORs = 'GE_01',
// }

export enum HttpStatusCode {
  _SUCCESS = 200,
  _INTERNAL_SERVER_ERROR = 500,
  _UNKNOWN_PARAMETERS_VALUE = 406,
  _APPLICATION_COMMUNICATION_FAILURE = 503,
  _BAD_REQUEST = 400,
  _UNAUTHORISED = 401,
  _NOT_FOUND = 404,
  _CONFLICT = 409,
  _BAD_GATEWAY = 502,
  _PRECONDITION_ERROR = 412,
  ECONNREFUSED = 'ECONNREFUSED',
}

export enum ErrorMessage {
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  _Duplicate_File = 'file all ready exists!',
  _Bridge_Already_Exists = 'Bridge Already Exists',
  _Invalid_link_speed_interfaces = `Invalid Link Speed Interfaces`,
  _Already_interfaces_are_attached_to_bridge = `Already interfaces are attached to bridge`,
  _Already_interfaces_are_in_L3_mode = `Already interfaces are in L3 Mode`,
  _Bridge_Not_Exists = `Bridge not exists`,
  _App_Group_Already_Exists = `App Group already exists`,
  _Error_while_deleting = `Error while deleting `,
  _Not_exists = `Not Exists`,
  _Not_Allowed = `Not Allowed `,
  _Already_Exists = `Already Exists`
}

export enum BULL_QUEUE {
  SCHEDULER_QUEUE = 'SCHEDULER_QUEUE' 
}
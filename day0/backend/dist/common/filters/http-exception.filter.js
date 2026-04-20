"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const error_codes_1 = require("../constants/error-codes");
let HttpExceptionFilter = class HttpExceptionFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = '服务器内部错误';
        if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse();
            if (typeof res === 'string') {
                message = res;
            }
            else if (typeof res === 'object' && res) {
                message = res.message;
                if (Array.isArray(res.message)) {
                    message = res.message?.join('; ') || message;
                }
            }
        }
        const code = status === common_1.HttpStatus.BAD_REQUEST
            ? error_codes_1.ErrorCodes.BAD_REQUEST
            : status === common_1.HttpStatus.NOT_FOUND
                ? error_codes_1.ErrorCodes.NOT_FOUND
                : status === common_1.HttpStatus.CONFLICT
                    ? error_codes_1.ErrorCodes.CONFLICT
                    : status === common_1.HttpStatus.UNAUTHORIZED
                        ? error_codes_1.ErrorCodes.UNAUTHORIZED
                        : status === common_1.HttpStatus.FORBIDDEN
                            ? error_codes_1.ErrorCodes.FORBIDDEN
                            : error_codes_1.ErrorCodes.INTERNAL_ERROR;
        response.status(status).json({
            code,
            message,
            data: null,
        });
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = __decorate([
    (0, common_1.Catch)()
], HttpExceptionFilter);
//# sourceMappingURL=http-exception.filter.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiliconflowError = void 0;
class SiliconflowError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}
exports.SiliconflowError = SiliconflowError;
//# sourceMappingURL=siliconflow.errors.js.map
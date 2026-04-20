"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    // 允许前端本地联调跨域访问
    app.enableCors({
        origin: true,
        credentials: true,
    });
    // 全局校验：统一 DTO 校验与类型转换
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
    }));
    // 全局异常过滤：统一非流式接口错误结构
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    const port = Number(process.env.PORT || 3000);
    await app.listen(port);
}
bootstrap();
//# sourceMappingURL=main.js.map
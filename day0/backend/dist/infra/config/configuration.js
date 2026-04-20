"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configuration = void 0;
const configuration = () => ({
    port: Number(process.env.PORT || 3000),
    db: {
        type: process.env.DB_TYPE || 'mysql',
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        username: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'Day0',
        synchronize: String(process.env.DB_SYNC || 'true') === 'true',
    },
    chat: {
        historyLimit: Number(process.env.CHAT_HISTORY_LIMIT || 20),
    },
    images: {
        maxBytes: Number(process.env.IMAGE_MAX_BYTES || 3145728),
    },
    siliconflow: {
        apiKey: process.env.SILICONFLOW_API_KEY || '',
        baseUrl: process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn',
        model: process.env.SILICONFLOW_MODEL || '',
    },
});
exports.configuration = configuration;
//# sourceMappingURL=configuration.js.map
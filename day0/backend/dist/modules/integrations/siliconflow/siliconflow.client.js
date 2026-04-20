"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SiliconflowClient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiliconflowClient = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const siliconflow_errors_1 = require("./siliconflow.errors");
let SiliconflowClient = SiliconflowClient_1 = class SiliconflowClient {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(SiliconflowClient_1.name);
    }
    // 以 AsyncGenerator 形式产出增量文本，便于上层逐段透传 SSE
    async *streamChatCompletion(payload, signal) {
        const apiKey = this.config.get('siliconflow.apiKey');
        const baseUrl = this.config.get('siliconflow.baseUrl');
        const model = this.config.get('siliconflow.model');
        if (!apiKey || !baseUrl || !model) {
            throw new siliconflow_errors_1.SiliconflowError('CONFIG_MISSING', '模型配置缺失');
        }
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                stream: true,
                messages: payload.messages,
            }),
            signal,
        });
        if (!response.ok || !response.body) {
            const text = await response.text();
            this.logger.error(`SiliconFlow 错误: ${response.status} ${text}`);
            throw new siliconflow_errors_1.SiliconflowError('UPSTREAM_ERROR', '模型服务请求失败');
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) {
                    continue;
                }
                // 按 SSE 协议逐行解析，提取 delta 增量内容
                const data = trimmed.replace(/^data:\s*/, '');
                if (data === '[DONE]') {
                    return;
                }
                try {
                    const parsed = JSON.parse(data);
                    const chunk = parsed.choices?.[0]?.delta?.content;
                    if (chunk) {
                        yield chunk;
                    }
                }
                catch (error) {
                    this.logger.warn(`SiliconFlow 解析失败: ${String(error)}`);
                }
            }
        }
    }
};
exports.SiliconflowClient = SiliconflowClient;
exports.SiliconflowClient = SiliconflowClient = SiliconflowClient_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], SiliconflowClient);
//# sourceMappingURL=siliconflow.client.js.map
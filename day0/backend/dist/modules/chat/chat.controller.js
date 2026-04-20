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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const common_1 = require("@nestjs/common");
const chat_service_1 = require("./chat.service");
const chat_stream_dto_1 = require("./dto/chat-stream.dto");
const sse_1 = require("../../common/constants/sse");
const error_codes_1 = require("../../common/constants/error-codes");
let ChatController = class ChatController {
    constructor(chatService) {
        this.chatService = chatService;
    }
    async stream(dto, req, res) {
        // SSE 基础头
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        // 明确禁用压缩，避免中间层或中间件缓冲
        res.setHeader('Content-Encoding', 'identity');
        // 立即 flush 头，提示浏览器开始消费流
        res.flushHeaders?.();
        // 发送注释行，避免部分客户端等待首个事件才渲染
        res.write(':\n\n');
        const abortController = new AbortController();
        const startedAt = Date.now();
        let cancelled = false;
        let heartbeatTimer = null;
        req.on('close', () => {
            cancelled = true;
            abortController.abort();
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
            }
            try {
                res.end();
            }
            catch {
                // ignore
            }
        });
        let assistantContent = '';
        try {
            // 心跳：保持连接活性，帮助排除代理缓冲
            heartbeatTimer = setInterval(() => {
                res.write('event: ping\ndata: {}\n\n');
            }, 15000);
            const { stream } = await this.chatService.prepareStream(dto, abortController.signal);
            for await (const chunk of stream) {
                if (process.env.NODE_ENV === 'development') {
                    console.log('[sse write]', Date.now(), chunk.length);
                }
                assistantContent += chunk;
                res.write(`event: ${sse_1.SSE_EVENTS.DELTA}\ndata: ${JSON.stringify({ content: chunk })}\n\n`);
            }
            if (cancelled) {
                res.write(`event: ${sse_1.SSE_EVENTS.ERROR}\ndata: ${JSON.stringify({
                    code: error_codes_1.ErrorCodes.CANCELLED,
                    message: '已取消',
                })}\n\n`);
                if (heartbeatTimer) {
                    clearInterval(heartbeatTimer);
                    heartbeatTimer = null;
                }
                res.end();
                return;
            }
            const assistantMessage = await this.chatService.finalizeAssistantMessage(dto.conversationId, assistantContent);
            res.write(`event: ${sse_1.SSE_EVENTS.DONE}\ndata: ${JSON.stringify({
                messageId: assistantMessage.id,
            })}\n\n`);
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
            }
            res.end();
        }
        catch (error) {
            const isCancelled = cancelled || abortController.signal.aborted;
            const errorCode = isCancelled ? error_codes_1.ErrorCodes.CANCELLED : error_codes_1.ErrorCodes.INTERNAL_ERROR;
            const errorMessage = isCancelled ? '已取消' : '对话生成失败';
            if (!res.headersSent) {
                res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            }
            res.write(`event: ${sse_1.SSE_EVENTS.ERROR}\ndata: ${JSON.stringify({
                code: errorCode,
                message: errorMessage,
            })}\n\n`);
            if (heartbeatTimer) {
                clearInterval(heartbeatTimer);
                heartbeatTimer = null;
            }
            res.end();
        }
        finally {
            const cost = Date.now() - startedAt;
            const logPayload = {
                conversationId: dto.conversationId,
                roleId: dto.roleId,
                hasImage: Boolean(dto.imageAssetId),
                imageAssetId: dto.imageAssetId ?? null,
                cancelled,
                costMs: cost,
            };
            // 这里仅记录最小可观测性日志
            console.log('[chat]', JSON.stringify(logPayload));
        }
    }
};
exports.ChatController = ChatController;
__decorate([
    (0, common_1.Post)('stream'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chat_stream_dto_1.ChatStreamDto, Object, Object]),
    __metadata("design:returntype", Promise)
], ChatController.prototype, "stream", null);
exports.ChatController = ChatController = __decorate([
    (0, common_1.Controller)('chat'),
    __metadata("design:paramtypes", [chat_service_1.ChatService])
], ChatController);
//# sourceMappingURL=chat.controller.js.map
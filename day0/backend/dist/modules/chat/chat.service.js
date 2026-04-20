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
var ChatService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const roles_service_1 = require("../roles/roles.service");
const conversations_service_1 = require("../conversations/conversations.service");
const messages_service_1 = require("../messages/messages.service");
const images_service_1 = require("../images/images.service");
const siliconflow_client_1 = require("../integrations/siliconflow/siliconflow.client");
const prompt_builder_1 = require("./prompt/prompt.builder");
let ChatService = ChatService_1 = class ChatService {
    constructor(rolesService, conversationsService, messagesService, imagesService, siliconflowClient, config) {
        this.rolesService = rolesService;
        this.conversationsService = conversationsService;
        this.messagesService = messagesService;
        this.imagesService = imagesService;
        this.siliconflowClient = siliconflowClient;
        this.config = config;
        this.logger = new common_1.Logger(ChatService_1.name);
    }
    async prepareStream(dto, signal) {
        const role = await this.rolesService.findById(dto.roleId);
        const conversation = await this.conversationsService.findById(dto.conversationId);
        if (conversation.roleId !== role.id) {
            this.logger.warn(`会话与角色不匹配: c=${conversation.id}, r=${role.id}`);
            throw new common_1.BadRequestException('会话与角色不匹配');
        }
        const historyLimit = Number(this.config.get('chat.historyLimit') || 20);
        const history = await this.messagesService.getRecentMessages(dto.conversationId, historyLimit);
        let imageBase64;
        let imageMime;
        if (dto.imageAssetId) {
            const asset = await this.imagesService.findById(dto.imageAssetId);
            const linkedMessage = await this.messagesService.findMessageByImageAsset(dto.imageAssetId);
            if (linkedMessage && linkedMessage.conversationId !== dto.conversationId) {
                this.logger.warn(`图片复用跨会话: image=${dto.imageAssetId}, from=${linkedMessage.conversationId}, to=${dto.conversationId}`);
                throw new common_1.BadRequestException('图片不属于当前会话');
            }
            imageBase64 = asset.bytes.toString('base64');
            imageMime = asset.mimeType;
        }
        // 先落库用户消息
        const userMessage = await this.messagesService.createMessage({
            conversationId: dto.conversationId,
            senderRole: 'user',
            content: dto.text,
            hasImage: Boolean(dto.imageAssetId),
            imageAssetId: dto.imageAssetId ?? null,
        });
        const promptMessages = prompt_builder_1.PromptBuilder.buildMessages({
            role,
            history,
            userText: dto.text,
            imageBase64,
            imageMime,
        });
        const stream = this.siliconflowClient.streamChatCompletion({ messages: promptMessages }, signal);
        return { stream, userMessage };
    }
    async finalizeAssistantMessage(conversationId, content) {
        return this.messagesService.createMessage({
            conversationId,
            senderRole: 'assistant',
            content,
            hasImage: false,
            imageAssetId: null,
        });
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = ChatService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [roles_service_1.RolesService,
        conversations_service_1.ConversationsService,
        messages_service_1.MessagesService,
        images_service_1.ImagesService,
        siliconflow_client_1.SiliconflowClient,
        config_1.ConfigService])
], ChatService);
//# sourceMappingURL=chat.service.js.map
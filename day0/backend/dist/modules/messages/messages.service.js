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
exports.MessagesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const message_entity_1 = require("./entities/message.entity");
const conversations_service_1 = require("../conversations/conversations.service");
let MessagesService = class MessagesService {
    constructor(messageRepo, conversationsService) {
        this.messageRepo = messageRepo;
        this.conversationsService = conversationsService;
    }
    async listByConversation(conversationId, page, pageSize) {
        await this.conversationsService.findById(conversationId);
        const [items, total] = await this.messageRepo.findAndCount({
            where: { conversationId },
            order: { createdAt: 'ASC' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        });
        return { items, total, page, pageSize };
    }
    async getRecentMessages(conversationId, limit) {
        const items = await this.messageRepo.find({
            where: { conversationId },
            order: { createdAt: 'DESC' },
            take: limit,
        });
        return items.reverse();
    }
    async createMessage(payload) {
        const message = this.messageRepo.create({
            conversationId: payload.conversationId,
            senderRole: payload.senderRole,
            content: payload.content,
            hasImage: payload.hasImage ?? false,
            imageAssetId: payload.imageAssetId ?? null,
        });
        return this.messageRepo.save(message);
    }
    async findMessageByImageAsset(imageAssetId) {
        return this.messageRepo.findOne({ where: { imageAssetId } });
    }
};
exports.MessagesService = MessagesService;
exports.MessagesService = MessagesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(message_entity_1.MessageEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        conversations_service_1.ConversationsService])
], MessagesService);
//# sourceMappingURL=messages.service.js.map
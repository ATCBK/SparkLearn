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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageEntity = void 0;
const typeorm_1 = require("typeorm");
const conversation_entity_1 = require("../../conversations/entities/conversation.entity");
const image_asset_entity_1 = require("../../images/entities/image-asset.entity");
let MessageEntity = class MessageEntity {
};
exports.MessageEntity = MessageEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], MessageEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'conversation_id' }),
    __metadata("design:type", Number)
], MessageEntity.prototype, "conversationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => conversation_entity_1.ConversationEntity, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'conversation_id' }),
    __metadata("design:type", conversation_entity_1.ConversationEntity)
], MessageEntity.prototype, "conversation", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sender_role', type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], MessageEntity.prototype, "senderRole", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'longtext' }),
    __metadata("design:type", String)
], MessageEntity.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'has_image', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], MessageEntity.prototype, "hasImage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'image_asset_id', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], MessageEntity.prototype, "imageAssetId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => image_asset_entity_1.ImageAssetEntity, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'image_asset_id' }),
    __metadata("design:type", Object)
], MessageEntity.prototype, "imageAsset", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], MessageEntity.prototype, "createdAt", void 0);
exports.MessageEntity = MessageEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'messages' })
], MessageEntity);
//# sourceMappingURL=message.entity.js.map
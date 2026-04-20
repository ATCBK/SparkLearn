"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const role_entity_1 = require("../../modules/roles/entities/role.entity");
const conversation_entity_1 = require("../../modules/conversations/entities/conversation.entity");
const message_entity_1 = require("../../modules/messages/entities/message.entity");
const image_asset_entity_1 = require("../../modules/images/entities/image-asset.entity");
let DatabaseModule = class DatabaseModule {
};
exports.DatabaseModule = DatabaseModule;
exports.DatabaseModule = DatabaseModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (config) => {
                    const dbType = (config.get('db.type') || 'mysql');
                    if (dbType === 'sqlite') {
                        return {
                            type: 'sqlite',
                            database: ':memory:',
                            entities: [role_entity_1.RoleEntity, conversation_entity_1.ConversationEntity, message_entity_1.MessageEntity, image_asset_entity_1.ImageAssetEntity],
                            synchronize: true,
                        };
                    }
                    return {
                        type: 'mysql',
                        host: config.get('db.host'),
                        port: config.get('db.port'),
                        username: config.get('db.username'),
                        password: config.get('db.password'),
                        database: config.get('db.database'),
                        synchronize: config.get('db.synchronize'),
                        entities: [role_entity_1.RoleEntity, conversation_entity_1.ConversationEntity, message_entity_1.MessageEntity, image_asset_entity_1.ImageAssetEntity],
                    };
                },
            }),
        ],
    })
], DatabaseModule);
//# sourceMappingURL=database.module.js.map
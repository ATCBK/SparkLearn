"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const infra_module_1 = require("./infra/infra.module");
const roles_module_1 = require("./modules/roles/roles.module");
const conversations_module_1 = require("./modules/conversations/conversations.module");
const messages_module_1 = require("./modules/messages/messages.module");
const images_module_1 = require("./modules/images/images.module");
const integrations_module_1 = require("./modules/integrations/integrations.module");
const chat_module_1 = require("./modules/chat/chat.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            infra_module_1.InfraModule,
            roles_module_1.RolesModule,
            conversations_module_1.ConversationsModule,
            messages_module_1.MessagesModule,
            images_module_1.ImagesModule,
            integrations_module_1.IntegrationsModule,
            chat_module_1.ChatModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
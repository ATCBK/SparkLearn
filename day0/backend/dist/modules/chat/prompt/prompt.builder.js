"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptBuilder = void 0;
const prompt_templates_1 = require("./prompt.templates");
class PromptBuilder {
    // Prompt 拼装策略：统一由角色设定 + 历史文本 + 当前输入构成
    static buildMessages(params) {
        const systemPrompt = (0, prompt_templates_1.buildRoleSystemPrompt)(params.role);
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        // 历史消息仅使用文本（不自动复用图片）
        params.history.forEach((msg) => {
            messages.push({ role: msg.senderRole, content: msg.content });
        });
        if (params.imageBase64 && params.imageMime) {
            // 当前输入携带图片时，使用多模态格式
            messages.push({
                role: 'user',
                content: [
                    { type: 'text', text: params.userText },
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:${params.imageMime};base64,${params.imageBase64}`,
                        },
                    },
                ],
            });
        }
        else {
            messages.push({ role: 'user', content: params.userText });
        }
        return messages;
    }
}
exports.PromptBuilder = PromptBuilder;
//# sourceMappingURL=prompt.builder.js.map
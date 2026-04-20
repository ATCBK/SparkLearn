"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRoleSystemPrompt = void 0;
const buildRoleSystemPrompt = (role) => {
    const sections = [
        role.persona ? `Persona: ${role.persona}` : null,
        role.background ? `Background: ${role.background}` : null,
        role.styleGuide ? `Style Guide: ${role.styleGuide}` : null,
        role.rules ? `Rules: ${role.rules}` : null,
        role.examplesJson ? `Examples: ${JSON.stringify(role.examplesJson)}` : null,
    ].filter(Boolean);
    return sections.join('\n');
};
exports.buildRoleSystemPrompt = buildRoleSystemPrompt;
//# sourceMappingURL=prompt.templates.js.map
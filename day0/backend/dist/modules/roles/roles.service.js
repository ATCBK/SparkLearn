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
exports.RolesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const role_entity_1 = require("./entities/role.entity");
let RolesService = class RolesService {
    constructor(roleRepo) {
        this.roleRepo = roleRepo;
    }
    async list() {
        return this.roleRepo.find({ order: { updatedAt: 'DESC' } });
    }
    async findById(id) {
        const role = await this.roleRepo.findOne({ where: { id } });
        if (!role) {
            throw new common_1.NotFoundException('角色不存在');
        }
        return role;
    }
    async create(dto) {
        const persona = dto.persona || `你是 ${dto.name}，请保持专业、简洁的回复风格。`;
        const role = this.roleRepo.create({
            ...dto,
            persona,
            enabled: dto.enabled ?? true,
        });
        return this.roleRepo.save(role);
    }
    async update(id, dto) {
        const role = await this.findById(id);
        Object.assign(role, dto);
        return this.roleRepo.save(role);
    }
    async remove(id) {
        await this.roleRepo.delete(id);
    }
};
exports.RolesService = RolesService;
exports.RolesService = RolesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(role_entity_1.RoleEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], RolesService);
//# sourceMappingURL=roles.service.js.map
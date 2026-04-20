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
var ImagesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImagesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const image_asset_entity_1 = require("./entities/image-asset.entity");
const hash_util_1 = require("../../common/utils/hash.util");
let ImagesService = ImagesService_1 = class ImagesService {
    constructor(imageRepo, config) {
        this.imageRepo = imageRepo;
        this.config = config;
        this.logger = new common_1.Logger(ImagesService_1.name);
        this.allowMimes = ['image/jpeg', 'image/png', 'image/webp'];
    }
    async createFromUpload(file) {
        if (!file) {
            throw new common_1.BadRequestException('缺少文件');
        }
        // 图片仅入库 LONGBLOB，不落盘；避免本地路径泄漏与额外存储依赖
        const maxBytes = Number(this.config.get('images.maxBytes') || 3145728);
        if (file.size > maxBytes) {
            this.logger.warn(`图片过大，size=${file.size}`);
            throw new common_1.BadRequestException('图片大小超过限制');
        }
        if (!this.allowMimes.includes(file.mimetype)) {
            this.logger.warn(`图片类型不允许，mime=${file.mimetype}`);
            throw new common_1.BadRequestException('图片类型不支持');
        }
        const asset = this.imageRepo.create({
            mimeType: file.mimetype,
            sizeBytes: file.size,
            bytes: file.buffer,
            sha256: (0, hash_util_1.sha256)(file.buffer),
        });
        const saved = await this.imageRepo.save(asset);
        return {
            imageAssetId: saved.id,
            mimeType: saved.mimeType,
            sizeBytes: saved.sizeBytes,
        };
    }
    async findById(id) {
        const asset = await this.imageRepo.findOne({ where: { id } });
        if (!asset) {
            throw new common_1.NotFoundException('图片不存在');
        }
        return asset;
    }
};
exports.ImagesService = ImagesService;
exports.ImagesService = ImagesService = ImagesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(image_asset_entity_1.ImageAssetEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        config_1.ConfigService])
], ImagesService);
//# sourceMappingURL=images.service.js.map
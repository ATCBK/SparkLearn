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
exports.ImageAssetEntity = void 0;
const typeorm_1 = require("typeorm");
let ImageAssetEntity = class ImageAssetEntity {
};
exports.ImageAssetEntity = ImageAssetEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], ImageAssetEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mime_type', length: 50 }),
    __metadata("design:type", String)
], ImageAssetEntity.prototype, "mimeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'size_bytes', type: 'int' }),
    __metadata("design:type", Number)
], ImageAssetEntity.prototype, "sizeBytes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], ImageAssetEntity.prototype, "width", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], ImageAssetEntity.prototype, "height", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], ImageAssetEntity.prototype, "sha256", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'longblob' }),
    __metadata("design:type", Buffer)
], ImageAssetEntity.prototype, "bytes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ImageAssetEntity.prototype, "createdAt", void 0);
exports.ImageAssetEntity = ImageAssetEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'image_assets' })
], ImageAssetEntity);
//# sourceMappingURL=image-asset.entity.js.map
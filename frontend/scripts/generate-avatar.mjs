/**
 * SparkLearn 数字人形象生成器 - 冬奥礼仪女性
 * 生成带 morph target 的 GLB 模型，用于视频页数字人渲染
 * 用法: node scripts/generate-avatar.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'avatars')
const OUT_FILE = join(OUT_DIR, 'default-avatar.glb')

// ====== 工具函数 ======

function degToRad(d) { return d * Math.PI / 180 }

function vec3Length(v, i) {
  return Math.sqrt(v[i] * v[i] + v[i + 1] * v[i + 1] + v[i + 2] * v[i + 2])
}

// ====== 颜色常量 (线性空间值, GLTF baseColorFactor 标准) ======
// sRGB → 线性转换: linear = (srgb/255)^2.2
const SKIN_COLOR = [0.80, 0.58, 0.40]   // 暖肤色 sRGB(232,199,166)
const HAIR_COLOR = [0.025, 0.012, 0.003] // 深棕黑发 sRGB(41,26,10)
const BLAZER_COLOR = [0.50, 0.07, 0.10]  // 玫红/中国红 sRGB(183,67,83)
const SHIRT_COLOR = [0.90, 0.90, 0.90]   // 白色内搭
const SKIRT_COLOR = [0.50, 0.07, 0.10]   // 同色玫红裙
const SHOE_COLOR = [0.015, 0.015, 0.020] // 黑色鞋 sRGB(31,31,36)
const EYE_WHITE = [0.90, 0.90, 0.90]
const EYE_IRIS = [0.04, 0.03, 0.015]    // 深棕瞳色 sRGB(51,38,19)

// ====== 1. 鹅蛋脸头部 ======

function createEggHeadGeometry(radius, widthSeg, heightSeg) {
  const positions = []
  const normals = []
  const uvs = []
  const indices = []

  for (let y = 0; y <= heightSeg; y++) {
    const v = y / heightSeg

    // 鹅蛋形: 上部略宽，下巴收尖，前后方向压扁(脸型)
    const phi = v * Math.PI * 0.95 // 下巴区域收窄
    const yPos = Math.cos(phi) * radius
    const ringRadius = Math.sin(phi) * radius

    // 下巴收窄系数
    const chinNarrow = v > 0.55 ? 1 - (v - 0.55) * 0.7 : 1 + v * 0.08

    for (let x = 0; x <= widthSeg; x++) {
      const u = x / widthSeg
      const theta = u * 2 * Math.PI

      // 前面(面部)压扁，后面保持
      const faceFlat = 0.82 + 0.18 * Math.cos(theta) // 面部区域压扁
      const rx = Math.sin(phi) * Math.cos(theta) * radius * faceFlat * chinNarrow
      const rz = Math.sin(phi) * Math.sin(theta) * radius * faceFlat * chinNarrow

      // 下巴尖化
      const chinFactor = 1 - Math.pow(Math.max(0, v - 0.65), 1.5) * 0.4
      const finalX = rx * chinFactor
      const finalZ = rz * chinFactor
      const finalY = yPos * 1.1 // 头部略拉高

      positions.push(finalX, finalY, finalZ)
      normals.push(
        finalX / (radius * faceFlat),
        finalY / radius,
        finalZ / (radius * faceFlat)
      )
      uvs.push(u, v)
    }
  }

  for (let y = 0; y < heightSeg; y++) {
    for (let x = 0; x < widthSeg; x++) {
      const a = y * (widthSeg + 1) + x
      const b = a + widthSeg + 1
      indices.push(a, b, a + 1)
      indices.push(b, b + 1, a + 1)
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
    vertexCount: positions.length / 3,
    indexCount: indices.length
  }
}

// ====== 2. 短发(波波头+空气刘海) ======

function createHairGeometry(headRadius) {
  const positions = []
  const normals = []
  const indices = []
  const widthSeg = 20
  const heightSeg = 12

  const hairRadius = headRadius * 1.06 // 略大于头部
  const topOffset = 0.08
  const bottomExtension = headRadius * 0.45 // 发尾延伸到下巴

  for (let y = 0; y <= heightSeg; y++) {
    const v = y / heightSeg
    // 发壳从头顶延伸到下巴
    const phi = v * Math.PI * 0.85
    const yPos = Math.cos(phi) * hairRadius + topOffset
    // 发尾内扣
    const inwardCurl = v > 0.75 ? (v - 0.75) * 0.25 : 0
    let ringRadius = Math.sin(phi) * hairRadius - inwardCurl * hairRadius

    // 后脑勺略宽
    const backFullness = 1 + 0.06 * (1 - v)

    for (let x = 0; x <= widthSeg; x++) {
      const theta = (x / widthSeg) * 2 * Math.PI
      // 后脑区域
      const backBias = 1 + 0.05 * (Math.cos(theta) < 0 ? Math.abs(Math.cos(theta)) : 0)
      const rx = Math.cos(theta) * ringRadius * backBias * backFullness
      const rz = Math.sin(theta) * ringRadius * backBias * backFullness

      positions.push(rx, yPos - bottomExtension, rz)
      normals.push(rx / hairRadius, 0.15, rz / hairRadius)
    }
  }

  for (let y = 0; y < heightSeg; y++) {
    for (let x = 0; x < widthSeg; x++) {
      const a = y * (widthSeg + 1) + x
      const b = a + widthSeg + 1
      indices.push(a, b, a + 1)
      indices.push(b, b + 1, a + 1)
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
    vertexCount: positions.length / 3,
    indexCount: indices.length
  }
}

// 刘海
function createBangsGeometry(headRadius) {
  const positions = []
  const normals = []
  const indices = []
  const segW = 10, segH = 4

  const browY = 0.2 // 眉毛高度附近
  const fringeTop = browY + 0.35

  for (let h = 0; h <= segH; h++) {
    const t = h / segH
    const y = fringeTop - t * (fringeTop - browY + 0.05)
    for (let w = 0; w <= segW; w++) {
      const a = (w / segW - 0.5) * Math.PI * 0.65
      const depth = (1 - Math.pow(Math.abs(w / segW - 0.5) * 2, 0.6)) * headRadius * 0.85
      const x = Math.sin(a) * headRadius * 0.95
      const z = depth + 0.02 + t * 0.04
      positions.push(x, y, z)
      normals.push(0, 0.2, 0.98)
    }
  }

  for (let h = 0; h < segH; h++) {
    for (let w = 0; w < segW; w++) {
      const a = h * (segW + 1) + w
      const b = a + segW + 1
      indices.push(a, b, a + 1)
      indices.push(b, b + 1, a + 1)
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
    vertexCount: positions.length / 3,
    indexCount: indices.length
  }
}

// ====== 3. 眼睛 ======

function createEyeGeometry(side, headRadius) {
  const positions = []
  const normals = []
  const indices = []

  const eyeX = side * headRadius * 0.25
  const eyeY = headRadius * 0.28
  const eyeZ = headRadius * 0.82
  const eyeW = headRadius * 0.14
  const eyeH = headRadius * 0.08
  const segW = 6, segH = 4

  for (let h = 0; h <= segH; h++) {
    const t = h / segH
    const y = eyeY + (t - 0.5) * eyeH * 2
    for (let w = 0; w <= segW; w++) {
      const s = w / segW
      const x = eyeX + (s - 0.5) * eyeW * 2
      // 眼球弧度
      const bulge = 0.02 * Math.sin(s * Math.PI)
      const z = eyeZ + bulge
      positions.push(x, y, z)
      normals.push(0, 0, 1)
    }
  }

  for (let h = 0; h < segH; h++) {
    for (let w = 0; w < segW; w++) {
      const a = h * (segW + 1) + w
      const b = a + segW + 1
      indices.push(a, b, a + 1)
      indices.push(b, b + 1, a + 1)
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
    vertexCount: positions.length / 3,
    indexCount: indices.length
  }
}

// ====== 4. 身体 ======

function createBodyGeometry() {
  const positions = []
  const normals = []
  const indices = []
  const segments = 16

  // 躯干: 从肩到腰
  const shoulderY = -0.65
  const waistY = -1.35
  const hipY = -1.55
  const shoulderR = 0.38
  const waistR = 0.26
  const hipR = 0.32

  // Shoulder ring
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    positions.push(Math.cos(a) * shoulderR, shoulderY, Math.sin(a) * shoulderR)
    normals.push(Math.cos(a) * 0.6, 0.4, Math.sin(a) * 0.6)
  }
  // Waist ring
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    positions.push(Math.cos(a) * waistR, waistY, Math.sin(a) * waistR)
    normals.push(Math.cos(a) * 0.5, -0.1, Math.sin(a) * 0.5)
  }
  // Hip ring
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    positions.push(Math.cos(a) * hipR, hipY, Math.sin(a) * hipR)
    normals.push(Math.cos(a) * 0.4, -0.3, Math.sin(a) * 0.4)
  }

  // 连接环
  for (let s = 0; s < 2; s++) {
    const offset = s * (segments + 1)
    for (let i = 0; i < segments; i++) {
      const a = offset + i, a1 = offset + i + 1
      const b = offset + segments + 1 + i, b1 = offset + segments + 1 + i + 1
      indices.push(a, b, a1)
      indices.push(b, b1, a1)
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
    vertexCount: positions.length / 3,
    indexCount: indices.length
  }
}

// ====== 5. 西装外套(玫红) ======
// 上半身外套，V领设计

function createBlazerGeometry() {
  const positions = []
  const normals = []
  const indices = []
  const seg = 16

  const topY = -0.65
  const waistY = -1.35
  const topR = 0.40  // 略大于身体，肩部
  const waistR = 0.28

  // Top ring
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2
    // V领区域留开
    const frontFactor = Math.abs(a - 0) < 0.35 && a < Math.PI * 0.25 || a > Math.PI * 1.75 ? 0.7 : 1
    positions.push(Math.cos(a) * topR * frontFactor, topY, Math.sin(a) * topR * frontFactor)
    normals.push(Math.cos(a) * 0.6, 0.4, Math.sin(a) * 0.6)
  }
  // Waist ring
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2
    positions.push(Math.cos(a) * waistR, waistY, Math.sin(a) * waistR)
    normals.push(Math.cos(a) * 0.4, -0.2, Math.sin(a) * 0.4)
  }

  const n = seg + 1
  for (let i = 0; i < seg; i++) {
    indices.push(i, n + i, i + 1)
    indices.push(n + i, n + i + 1, i + 1)
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
    vertexCount: positions.length / 3,
    indexCount: indices.length
  }
}

// ====== 6. 衬衫领(白色) ======

function createCollarGeometry() {
  const positions = []
  const normals = []
  const indices = []

  // V领两侧白色翻领(三角片)
  const collarTop = -0.62
  const collarBottom = -0.82
  const collarZ = 0.35
  const halfWidth = 0.12

  // 左领
  positions.push(-0.03, collarTop, collarZ + 0.04)  // 0: 中心顶
  positions.push(-halfWidth, collarBottom, collarZ + 0.02)  // 1: 左底
  positions.push(-halfWidth - 0.04, collarTop + 0.02, collarZ - 0.02)  // 2: 左顶外
  normals.push(0.2, 0.5, 0.85)
  normals.push(0.2, 0.3, 0.9)
  normals.push(0.15, 0.5, 0.85)
  indices.push(0, 1, 2)

  // 右领
  const base = 3
  positions.push(0.03, collarTop, collarZ + 0.04)  // 3: 中心顶
  positions.push(halfWidth, collarBottom, collarZ + 0.02)  // 4: 右底
  positions.push(halfWidth + 0.04, collarTop + 0.02, collarZ - 0.02)  // 5: 右顶外
  normals.push(-0.2, 0.5, 0.85)
  normals.push(-0.2, 0.3, 0.9)
  normals.push(-0.15, 0.5, 0.85)
  indices.push(base, base + 1, base + 2)

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
    vertexCount: positions.length / 3,
    indexCount: indices.length
  }
}

// ====== 7. 裙子(及膝一步裙) ======

function createSkirtGeometry() {
  const positions = []
  const normals = []
  const indices = []
  const seg = 16

  const topY = -1.50
  const bottomY = -2.20
  const topR = 0.33
  const bottomR = 0.30
  const slitAngle = Math.PI * 0.25 // 右侧小开叉位置

  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2
    // 裙摆微收
    const rTop = a > slitAngle - 0.1 && a < slitAngle + 0.1 ? topR * 0.85 : topR
    positions.push(Math.cos(a) * rTop, topY, Math.sin(a) * rTop)
    normals.push(Math.cos(a) * 0.3, 0.5, Math.sin(a) * 0.3)
  }
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2
    const rBot = a > slitAngle - 0.1 && a < slitAngle + 0.1 ? bottomR * 0.80 : bottomR
    positions.push(Math.cos(a) * rBot, bottomY, Math.sin(a) * rBot)
    normals.push(Math.cos(a) * 0.2, 0.3, Math.sin(a) * 0.2)
  }

  const n = seg + 1
  for (let i = 0; i < seg; i++) {
    indices.push(i, n + i, i + 1)
    indices.push(n + i, n + i + 1, i + 1)
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
    vertexCount: positions.length / 3,
    indexCount: indices.length
  }
}

// ====== 8. 鞋 ======

function createShoeGeometry(side) {
  const positions = []
  const normals = []
  const indices = []

  const shoeX = side * 0.12
  const shoeY = -2.18
  const shoeZ = 0.06
  const w = 0.08, h = 0.06, d = 0.16

  // 简单方块 + 前圆
  const v = [
    [-w, h * 0.5, -d * 0.3], [w, h * 0.5, -d * 0.3], [w, -h, -d * 0.3], [-w, -h, -d * 0.3],
    [-w * 0.9, h * 0.5, d * 0.7], [w * 0.9, h * 0.5, d * 0.7], [w * 0.9, -h, d * 0.7], [-w * 0.9, -h, d * 0.7],
  ]
  const faces = [
    [0, 1, 2], [0, 2, 3], [4, 5, 1], [4, 1, 0],
    [1, 5, 6], [1, 6, 2], [5, 4, 7], [5, 7, 6],
    [4, 0, 3], [4, 3, 7], [3, 2, 6], [3, 6, 7],
  ]

  for (const vtx of v) {
    positions.push(vtx[0] + shoeX, vtx[1] + shoeY, vtx[2] + shoeZ)
    normals.push(0, 1, 0)
  }
  for (const [a, b, c] of faces) indices.push(a, b, c)

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
    vertexCount: positions.length / 3,
    indexCount: indices.length
  }
}

// ====== Morph Targets (面部表情) ======

const VISEME_NAMES = [
  'viseme_sil', 'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD',
  'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR',
  'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U',
]

function createMorphTargets(headPositions, headRadius) {
  const morphs = {}
  const count = headPositions.length

  // 判断顶点是否在嘴部区域
  function isMouth(i) {
    const x = headPositions[i]
    const y = headPositions[i + 1]
    const z = headPositions[i + 2]
    // 嘴部: 前面下方
    return z > headRadius * 0.55 && y < headRadius * 0.1 && y > -headRadius * 0.35
      && Math.abs(x) < headRadius * 0.35
  }

  function isUpperLip(i) {
    const x = headPositions[i]; const y = headPositions[i + 1]; const z = headPositions[i + 2]
    return z > headRadius * 0.55 && y < 0 && y > -headRadius * 0.2 && Math.abs(x) < headRadius * 0.28
  }

  function isLowerLip(i) {
    const x = headPositions[i]; const y = headPositions[i + 1]; const z = headPositions[i + 2]
    return z > headRadius * 0.55 && y < -headRadius * 0.08 && y > -headRadius * 0.35 && Math.abs(x) < headRadius * 0.28
  }

  // viseme_aa: 张大嘴 (a 音)
  morphs.viseme_aa = new Float32Array(count)
  for (let i = 0; i < count / 3; i++) {
    if (isLowerLip(i * 3)) {
      const y = headPositions[i * 3 + 1]
      const factor = (y + headRadius * 0.35) / (headRadius * 0.27)
      morphs.viseme_aa[i * 3 + 1] = -0.07 * factor
      morphs.viseme_aa[i * 3 + 2] = 0.02 * factor
    }
    if (isUpperLip(i * 3)) {
      const y = headPositions[i * 3 + 1]
      const factor = (headRadius * 0.1 - Math.abs(y)) / (headRadius * 0.1)
      morphs.viseme_aa[i * 3 + 1] = 0.04 * factor
    }
  }

  // viseme_sil: 闭嘴
  morphs.viseme_sil = new Float32Array(count)
  for (let i = 0; i < count / 3; i++) {
    if (isMouth(i * 3)) {
      morphs.viseme_sil[i * 3 + 2] = -0.015
    }
  }

  // viseme_PP: 闭唇爆破音 (p/b/m)
  morphs.viseme_PP = new Float32Array(count)
  for (let i = 0; i < count / 3; i++) {
    if (isMouth(i * 3)) {
      morphs.viseme_PP[i * 3 + 2] = -0.03
    }
  }

  // viseme_FF: 唇齿音 (f/v)
  morphs.viseme_FF = new Float32Array(count)
  for (let i = 0; i < count / 3; i++) {
    if (isLowerLip(i * 3)) {
      morphs.viseme_FF[i * 3 + 2] = -0.02
      morphs.viseme_FF[i * 3 + 1] = 0.01
    }
  }

  // viseme_TH: 舌尖音 (th)
  morphs.viseme_TH = new Float32Array(count)
  for (let i = 0; i < count / 3; i++) {
    if (isMouth(i * 3)) {
      morphs.viseme_TH[i * 3 + 1] = 0.015
    }
  }

  // viseme_DD: 舌尖齿龈音 (d/t)
  morphs.viseme_DD = new Float32Array(count)
  for (let i = 0; i < count / 3; i++) {
    if (isUpperLip(i * 3)) {
      morphs.viseme_DD[i * 3 + 2] = 0.02
    }
  }

  // viseme_kk: 软颚音 (k/g)
  morphs.viseme_kk = new Float32Array(count)
  for (let i = 0; i < count / 3; i++) {
    if (isMouth(i * 3)) {
      morphs.viseme_kk[i * 3 + 1] = -0.02
      morphs.viseme_kk[i * 3 + 2] = -0.01
    }
  }

  // viseme_CH: 颚龈音 (ch/j)
  morphs.viseme_CH = new Float32Array(count)
  for (let i = 0; i < count / 3; i++) {
    if (isMouth(i * 3)) {
      morphs.viseme_CH[i * 3 + 2] = 0.03
    }
  }

  // viseme_SS: 齿擦音 (s/z)
  morphs.viseme_SS = new Float32Array(count)
  for (let i = 0; i < count / 3; i++) {
    if (isMouth(i * 3)) {
      morphs.viseme_SS[i * 3 + 1] = 0.01
      morphs.viseme_SS[i * 3 + 2] = 0.015
    }
  }

  // viseme_nn: 鼻音 (n)
  morphs.viseme_nn = new Float32Array(count)
  for (let i = 0; i < count / 3; i++) {
    if (isMouth(i * 3)) {
      morphs.viseme_nn[i * 3 + 2] = -0.01
      morphs.viseme_nn[i * 3 + 1] = 0.02
    }
  }

  // viseme_RR: 卷舌音 (r)
  morphs.viseme_RR = new Float32Array(count)
  for (let i = 0; i < count / 3; i++) {
    if (isMouth(i * 3)) {
      morphs.viseme_RR[i * 3 + 2] = 0.025
    }
  }

  // viseme_E: e 音
  morphs.viseme_E = new Float32Array(count)
  for (let i = 0; i < count / 3; i++) {
    if (isMouth(i * 3)) {
      const x = headPositions[i * 3]
      morphs.viseme_E[i * 3] = x > 0 ? 0.02 : -0.02
    }
  }

  // viseme_I: i 音
  morphs.viseme_I = new Float32Array(count)
  for (let i = 0; i < count / 3; i++) {
    if (isMouth(i * 3)) {
      morphs.viseme_I[i * 3 + 1] = -0.025
    }
  }

  // viseme_O: o 音 (撮口)
  morphs.viseme_O = new Float32Array(count)
  for (let i = 0; i < count / 3; i++) {
    if (isMouth(i * 3)) {
      const x = headPositions[i * 3]
      morphs.viseme_O[i * 3] = x > 0 ? -0.015 : 0.015
      morphs.viseme_O[i * 3 + 2] = 0.02
    }
  }

  // viseme_U: u 音
  morphs.viseme_U = new Float32Array(count)
  for (let i = 0; i < count / 3; i++) {
    if (isMouth(i * 3)) {
      const x = headPositions[i * 3]
      morphs.viseme_U[i * 3] = x > 0 ? -0.02 : 0.02
      morphs.viseme_U[i * 3 + 2] = 0.025
    }
  }

  // blink: 闭眼
  morphs.blink = new Float32Array(count)
  for (let i = 0; i < count / 3; i++) {
    const x = headPositions[i * 3]
    const y = headPositions[i * 3 + 1]
    const z = headPositions[i * 3 + 2]
    for (const eyeX of [-headRadius * 0.25, headRadius * 0.25]) {
      const dx = x - eyeX
      const dy = y - headRadius * 0.28
      if (Math.abs(dx) < headRadius * 0.1 && Math.abs(dy) < headRadius * 0.06 && z > headRadius * 0.7) {
        const factor = (1 - Math.abs(dx) / (headRadius * 0.1)) * (1 - Math.abs(dy) / (headRadius * 0.06))
        morphs.blink[i * 3 + 1] = -0.03 * factor
      }
    }
  }

  return morphs
}

// ====== GLB 构建器 ======

function buildGLB(meshes) {
  let totalBytes = 0
  const bufferViews = []
  const accessors = []

  function addBufferView(data, target) {
    const byteOffset = totalBytes
    const byteLength = data.byteLength
    const padding = (4 - (byteLength % 4)) % 4
    bufferViews.push({ buffer: 0, byteOffset, byteLength, target })
    totalBytes += byteLength + padding
    return bufferViews.length - 1
  }

  function addAccessor(bufferViewIdx, componentType, count, type, min, max) {
    const idx = accessors.length
    const acc = { bufferView: bufferViewIdx, componentType, count, type }
    if (min) { acc.min = min; acc.max = max }
    accessors.push(acc)
    return idx
  }

  function computeMinMax(data, stride) {
    const min = new Array(stride).fill(Infinity)
    const max = new Array(stride).fill(-Infinity)
    for (let i = 0; i < data.length; i++) {
      const m = i % stride
      if (data[i] < min[m]) min[m] = data[i]
      if (data[i] > max[m]) max[m] = data[i]
    }
    return { min, max }
  }

  // Cached accessor indices per mesh
  const meshData = meshes.map(mesh => {
    const posBV = addBufferView(mesh.positions, 34962)
    const posMM = computeMinMax(mesh.positions, 3)
    const posAcc = addAccessor(posBV, 5126, mesh.positions.length / 3, 'VEC3', posMM.min, posMM.max)

    const normBV = addBufferView(mesh.normals, 34962)
    const normAcc = addAccessor(normBV, 5126, mesh.normals.length / 3, 'VEC3')

    let idxBV = -1, idxAcc = -1
    if (mesh.indices && mesh.indices.length > 0) {
      idxBV = addBufferView(mesh.indices, 34963)
      idxAcc = addAccessor(idxBV, 5123, mesh.indices.length, 'SCALAR')
    }

    // Morph target accessors
    const morphAccIndices = (mesh.morphTargets || []).map(mt => {
      const bv = addBufferView(mt, 34962)
      const mm = computeMinMax(mt, 3)
      return addAccessor(bv, 5126, mt.length / 3, 'VEC3', mm.min, mm.max)
    })

    return { posAcc, normAcc, idxAcc, morphAccIndices }
  })

  // Deduplicate materials by their definition key
  const matCompactMap = new Map()
  const compactMaterials = []
  meshes.forEach((mesh, i) => {
    if (mesh.material && mesh.materialIndex !== undefined) {
      const key = mesh.material.name || JSON.stringify(mesh.material.pbrMetallicRoughness)
      if (!matCompactMap.has(mesh.materialIndex)) {
        matCompactMap.set(mesh.materialIndex, compactMaterials.length)
        compactMaterials.push(mesh.material)
      }
    }
  })

  const gltf = {
    asset: { version: '2.0', generator: 'SparkLearn Avatar v2' },
    scene: 0,
    scenes: [{ nodes: meshes.map((_, i) => i) }],
    nodes: meshes.map((mesh, i) => ({
      name: mesh.name || `mesh_${i}`,
      mesh: i
    })),
    meshes: meshes.map((mesh, i) => {
      const prim = {
        attributes: {
          POSITION: meshData[i].posAcc,
          NORMAL: meshData[i].normAcc
        },
      }
      if (meshData[i].idxAcc >= 0) prim.indices = meshData[i].idxAcc
      if (mesh.morphTargets && mesh.morphTargets.length > 0) {
        prim.targets = mesh.morphTargets.map((_, mi) => ({
          POSITION: meshData[i].morphAccIndices[mi]
        }))
      }
      if (mesh.materialIndex !== undefined) {
        prim.material = matCompactMap.get(mesh.materialIndex) ?? 0
      }

      const m = {
        name: mesh.name || `mesh_${i}`,
        primitives: [prim]
      }
      if (mesh.targetNames) m.extras = { targetNames: mesh.targetNames }
      return m
    }),
    materials: compactMaterials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: totalBytes }]
  }

  const jsonStr = JSON.stringify(gltf)
  const jsonBuf = Buffer.from(jsonStr, 'utf8')
  const jsonPadding = (4 - (jsonBuf.length % 4)) % 4

  // Build binary buffer
  const binBuf = Buffer.alloc(totalBytes)
  let offset = 0

  function writeData(data) {
    const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
    buf.copy(binBuf, offset)
    const padding = (4 - (data.byteLength % 4)) % 4
    offset += data.byteLength + padding
  }

  for (const mesh of meshes) {
    writeData(mesh.positions)
    writeData(mesh.normals)
    if (mesh.indices && mesh.indices.length > 0) writeData(mesh.indices)
    for (const mt of (mesh.morphTargets || [])) writeData(mt)
  }

  const binPadding = (4 - (binBuf.length % 4)) % 4

  const headerSize = 12
  const jsonChunkSize = 8 + jsonBuf.length + jsonPadding
  const binChunkSize = 8 + binBuf.length + binPadding
  const totalSize = headerSize + jsonChunkSize + binChunkSize

  const glb = Buffer.alloc(totalSize)
  let pos = 0

  glb.writeUInt32LE(0x46546C67, pos); pos += 4
  glb.writeUInt32LE(2, pos); pos += 4
  glb.writeUInt32LE(totalSize, pos); pos += 4

  glb.writeUInt32LE(jsonBuf.length + jsonPadding, pos); pos += 4
  glb.writeUInt32LE(0x4E4F534A, pos); pos += 4
  jsonBuf.copy(glb, pos); pos += jsonBuf.length
  for (let i = 0; i < jsonPadding; i++) { glb.writeUInt8(0x20, pos); pos++ }

  glb.writeUInt32LE(binBuf.length + binPadding, pos); pos += 4
  glb.writeUInt32LE(0x004E4942, pos); pos += 4
  binBuf.copy(glb, pos); pos += binBuf.length
  for (let i = 0; i < binPadding; i++) { glb.writeUInt8(0, pos); pos++ }

  return glb
}

// ====== 主流程 ======

const headGeom = createEggHeadGeometry(0.5, 24, 16)
const hairGeom = createHairGeometry(0.5)
const bangsGeom = createBangsGeometry(0.5)
const leftEyeGeom = createEyeGeometry(-1, 0.5)
const rightEyeGeom = createEyeGeometry(1, 0.5)
const bodyGeom = createBodyGeometry()
const blazerGeom = createBlazerGeometry()
const collarGeom = createCollarGeometry()
const skirtGeom = createSkirtGeometry()
const leftShoeGeom = createShoeGeometry(-1)
const rightShoeGeom = createShoeGeometry(1)

// Morph targets on head
const morphTargets = createMorphTargets(headGeom.positions, 0.5)
const morphNames = Object.keys(morphTargets)

const meshes = [
  {
    name: 'Head',
    positions: headGeom.positions,
    normals: headGeom.normals,
    indices: headGeom.indices,
    morphTargets: morphNames.map(n => morphTargets[n]),
    targetNames: morphNames,
    material: {
      name: 'Skin',
      pbrMetallicRoughness: {
        baseColorFactor: [...SKIN_COLOR, 1.0],
        metallicFactor: 0.0,
        roughnessFactor: 0.65
      }
    },
    materialIndex: 0
  },
  {
    name: 'Hair',
    positions: hairGeom.positions,
    normals: hairGeom.normals,
    indices: hairGeom.indices,
    material: {
      name: 'Hair',
      pbrMetallicRoughness: {
        baseColorFactor: [...HAIR_COLOR, 1.0],
        metallicFactor: 0.05,
        roughnessFactor: 0.7
      }
    },
    materialIndex: 1
  },
  {
    name: 'Bangs',
    positions: bangsGeom.positions,
    normals: bangsGeom.normals,
    indices: bangsGeom.indices,
    material: {
      name: 'Hair',
      pbrMetallicRoughness: {
        baseColorFactor: [...HAIR_COLOR, 1.0],
        metallicFactor: 0.05,
        roughnessFactor: 0.7
      }
    },
    materialIndex: 1
  },
  {
    name: 'LeftEye',
    positions: leftEyeGeom.positions,
    normals: leftEyeGeom.normals,
    indices: leftEyeGeom.indices,
    material: {
      name: 'Eye',
      pbrMetallicRoughness: {
        baseColorFactor: [...EYE_IRIS, 1.0],
        metallicFactor: 0.1,
        roughnessFactor: 0.4
      }
    },
    materialIndex: 2
  },
  {
    name: 'RightEye',
    positions: rightEyeGeom.positions,
    normals: rightEyeGeom.normals,
    indices: rightEyeGeom.indices,
    material: {
      name: 'Eye',
      pbrMetallicRoughness: {
        baseColorFactor: [...EYE_IRIS, 1.0],
        metallicFactor: 0.1,
        roughnessFactor: 0.4
      }
    },
    materialIndex: 2
  },
  {
    name: 'Body',
    positions: bodyGeom.positions,
    normals: bodyGeom.normals,
    indices: bodyGeom.indices,
    material: {
      name: 'Shirt',
      pbrMetallicRoughness: {
        baseColorFactor: [...SHIRT_COLOR, 1.0],
        metallicFactor: 0.0,
        roughnessFactor: 0.85
      }
    },
    materialIndex: 3
  },
  {
    name: 'Blazer',
    positions: blazerGeom.positions,
    normals: blazerGeom.normals,
    indices: blazerGeom.indices,
    material: {
      name: 'Blazer',
      pbrMetallicRoughness: {
        baseColorFactor: [...BLAZER_COLOR, 1.0],
        metallicFactor: 0.05,
        roughnessFactor: 0.55
      }
    },
    materialIndex: 4
  },
  {
    name: 'Collar',
    positions: collarGeom.positions,
    normals: collarGeom.normals,
    indices: collarGeom.indices,
    material: {
      name: 'Shirt',
      pbrMetallicRoughness: {
        baseColorFactor: [...SHIRT_COLOR, 1.0],
        metallicFactor: 0.0,
        roughnessFactor: 0.85
      }
    },
    materialIndex: 3
  },
  {
    name: 'Skirt',
    positions: skirtGeom.positions,
    normals: skirtGeom.normals,
    indices: skirtGeom.indices,
    material: {
      name: 'Skirt',
      pbrMetallicRoughness: {
        baseColorFactor: [...SKIRT_COLOR, 1.0],
        metallicFactor: 0.05,
        roughnessFactor: 0.55
      }
    },
    materialIndex: 4
  },
  {
    name: 'LeftShoe',
    positions: leftShoeGeom.positions,
    normals: leftShoeGeom.normals,
    indices: leftShoeGeom.indices,
    material: {
      name: 'Shoe',
      pbrMetallicRoughness: {
        baseColorFactor: [...SHOE_COLOR, 1.0],
        metallicFactor: 0.1,
        roughnessFactor: 0.6
      }
    },
    materialIndex: 5
  },
  {
    name: 'RightShoe',
    positions: rightShoeGeom.positions,
    normals: rightShoeGeom.normals,
    indices: rightShoeGeom.indices,
    material: {
      name: 'Shoe',
      pbrMetallicRoughness: {
        baseColorFactor: [...SHOE_COLOR, 1.0],
        metallicFactor: 0.1,
        roughnessFactor: 0.6
      }
    },
    materialIndex: 5
  },
]

const glb = buildGLB(meshes)

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT_FILE, glb)

console.log(`✓ 生成完成: ${OUT_FILE} (${(glb.length / 1024).toFixed(1)} KB)`)
console.log(`  总网格: ${meshes.length}`)
console.log(`  头部顶点: ${headGeom.vertexCount}, 三角形: ${headGeom.indexCount / 3}`)
console.log(`  总顶点: ~${meshes.reduce((s, m) => s + m.positions.length / 3, 0).toFixed(0)}`)
console.log(`  Morph targets: ${morphNames.join(', ')}`)

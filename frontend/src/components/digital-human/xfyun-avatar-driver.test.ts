import { describe, expect, it, vi } from 'vitest'
import {
  XfyunAvatarDriver,
  type AvatarPlatform,
} from './xfyun-avatar-driver'

function createPlatform() {
  const player = {
    muted: true,
    defaultMuted: true,
    resume: vi.fn(async () => undefined),
  }
  const interrupt = vi.fn(async () => undefined)
  const writeText = vi.fn(async () => 'request-1')
  const platform: AvatarPlatform = {
    player,
    interrupt,
    writeText,
    stop: vi.fn(),
    destroy: vi.fn(),
    createPlayer: vi.fn(() => player),
  }
  return { platform, player, interrupt, writeText }
}

describe('讯飞数字人播报驱动', () => {
  it('连接后先打断旧播报再驱动完整回答', async () => {
    const { platform, interrupt, writeText } = createPlatform()
    const driver = new XfyunAvatarDriver(platform)
    driver.markConnected(true)

    await driver.speak('  变量用于保存数据  ')

    expect(interrupt).toHaveBeenCalledOnce()
    expect(writeText).toHaveBeenCalledWith(
      '变量用于保存数据',
      expect.objectContaining({
        nlp: false,
        avatar_dispatch: expect.objectContaining({ interactive_mode: 1 }),
      }),
    )
    expect(interrupt.mock.invocationCallOrder[0]).toBeLessThan(
      writeText.mock.invocationCallOrder[0],
    )
  })

  it('未连接时拒绝播报但空文本直接忽略', async () => {
    const { platform, writeText } = createPlatform()
    const driver = new XfyunAvatarDriver(platform)
    await driver.speak('   ')
    await expect(driver.speak('回答')).rejects.toThrow('DH_NOT_READY')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('用户解除静音时恢复播放器', async () => {
    const { platform, player } = createPlatform()
    const driver = new XfyunAvatarDriver(platform)
    await driver.setMuted(false)
    expect(player.muted).toBe(false)
    expect(player.resume).toHaveBeenCalledOnce()
  })

  it('销毁时停止并释放平台', () => {
    const { platform } = createPlatform()
    const driver = new XfyunAvatarDriver(platform)
    driver.dispose()
    expect(platform.stop).toHaveBeenCalledOnce()
    expect(platform.destroy).toHaveBeenCalledOnce()
  })
})

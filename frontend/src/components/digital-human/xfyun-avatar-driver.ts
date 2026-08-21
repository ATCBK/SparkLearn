export interface AvatarPlayer {
  muted: boolean
  defaultMuted: boolean
  resume: () => Promise<void>
}

export interface AvatarPlatform {
  player?: AvatarPlayer
  interrupt: () => Promise<void>
  writeText: (text: string, extend: Record<string, unknown>) => Promise<string>
  createPlayer: () => AvatarPlayer
  stop: () => void
  destroy: () => void
}

export interface XfyunDigitalHumanHandle {
  speak(text: string): Promise<void>
  interrupt(): Promise<void>
  setMuted(muted: boolean): Promise<void>
  isReady(): boolean
}

export class XfyunAvatarDriver implements XfyunDigitalHumanHandle {
  private connected = false

  constructor(private readonly platform: AvatarPlatform) {}

  markConnected(connected: boolean) {
    this.connected = connected
  }

  isReady() {
    return this.connected
  }

  async speak(text: string) {
    const content = text.trim()
    if (!content) return
    if (!this.connected) throw new Error('DH_NOT_READY')
    await this.platform.interrupt()
    await this.platform.writeText(content, {
      nlp: false,
      avatar_dispatch: {
        interactive_mode: 1,
        content_analysis: 1,
      },
      air: {
        air: 1,
        add_nonsemantic: 1,
      },
    })
  }

  async interrupt() {
    if (!this.connected) return
    await this.platform.interrupt()
  }

  async setMuted(muted: boolean) {
    const player = this.platform.player || this.platform.createPlayer()
    player.defaultMuted = muted
    player.muted = muted
    if (!muted) await player.resume()
  }

  dispose() {
    this.connected = false
    this.platform.stop()
    this.platform.destroy()
  }
}

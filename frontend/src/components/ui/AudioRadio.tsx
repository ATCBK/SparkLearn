'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, Radio, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils/cn'

export interface RadioTrack {
  id: string
  title: string
  text: string
  subtitle?: string
}

interface AudioRadioProps {
  tracks: RadioTrack[]
  className?: string
}

type PlayState = 'idle' | 'loading' | 'playing' | 'paused'

export function AudioRadio({ tracks, className }: AudioRadioProps) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [playState, setPlayState] = useState<PlayState>('idle')
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const animFrameRef = useRef<number>(0)

  const currentTrack = tracks[currentTrackIndex] || null

  const cleanupAudio = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => cleanupAudio()
  }, [cleanupAudio])

  const updateProgress = useCallback(() => {
    if (audioRef.current && playState === 'playing') {
      setProgress(audioRef.current.currentTime)
      animFrameRef.current = requestAnimationFrame(updateProgress)
    }
  }, [playState])

  useEffect(() => {
    if (playState === 'playing') {
      animFrameRef.current = requestAnimationFrame(updateProgress)
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [playState, updateProgress])

  async function playTrack(index: number) {
    if (!tracks[index]) return
    cleanupAudio()
    setError(null)
    setProgress(0)
    setDuration(0)
    setCurrentTrackIndex(index)
    setPlayState('loading')

    try {
      const blob = await api.synthesizeSpeech(tracks[index].text)
      const url = URL.createObjectURL(blob)
      blobUrlRef.current = url

      const audio = new Audio(url)
      audioRef.current = audio
      audio.muted = muted

      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration)
      })
      audio.addEventListener('ended', () => {
        setPlayState('idle')
        setProgress(0)
        if (index < tracks.length - 1) {
          playTrack(index + 1)
        }
      })
      audio.addEventListener('error', () => {
        setError('音频播放失败')
        setPlayState('idle')
      })

      await audio.play()
      setPlayState('playing')
    } catch (e) {
      setError(e instanceof Error ? e.message : '语音合成失败')
      setPlayState('idle')
    }
  }

  function togglePlay() {
    if (playState === 'idle') {
      playTrack(currentTrackIndex)
    } else if (playState === 'playing') {
      audioRef.current?.pause()
      setPlayState('paused')
    } else if (playState === 'paused') {
      audioRef.current?.play()
      setPlayState('playing')
    }
  }

  function skipPrev() {
    const prev = Math.max(0, currentTrackIndex - 1)
    if (prev !== currentTrackIndex || playState !== 'idle') {
      playTrack(prev)
    }
  }

  function skipNext() {
    const next = Math.min(tracks.length - 1, currentTrackIndex + 1)
    if (next !== currentTrackIndex) {
      playTrack(next)
    }
  }

  function toggleMute() {
    setMuted((m) => {
      const next = !m
      if (audioRef.current) audioRef.current.muted = next
      return next
    })
  }

  function seekTo(e: React.MouseEvent<HTMLDivElement>) {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audioRef.current.currentTime = ratio * duration
    setProgress(ratio * duration)
  }

  function formatTime(sec: number) {
    if (!sec || !isFinite(sec)) return '0:00'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (tracks.length === 0) return null

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0

  return (
    <div className={cn('rounded-[14px] border border-line bg-white overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-line bg-[#f9fafb]">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#ecfeff] text-[#0891b2]">
          <Radio className={cn('h-4 w-4', playState === 'playing' && 'animate-pulse')} />
        </div>
        <div className="flex-1 min-w-0">
          <b className="block text-small text-ink">SparkLearn 播客电台</b>
          <span className="text-micro text-muted">{tracks.length} 个片段 · AI 语音合成</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#ecfeff] px-2.5 py-1 text-[11px] font-bold text-[#0891b2]">
          {currentTrackIndex + 1}/{tracks.length}
        </span>
      </div>

      {/* Now playing */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start gap-3 mb-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br from-[#06b6d4] to-[#0891b2] text-white shadow-sm">
            <Radio className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-small font-bold text-ink truncate">{currentTrack?.title || '准备播放'}</p>
            {currentTrack?.subtitle && (
              <p className="text-micro text-muted mt-0.5 line-clamp-2">{currentTrack.subtitle}</p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div
            className="relative h-[6px] rounded-full bg-[#e8eff8] cursor-pointer group"
            onClick={seekTo}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#06b6d4] to-[#0891b2] transition-[width] duration-100"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#0891b2] shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${progressPercent}% - 6px)` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-muted">{formatTime(progress)}</span>
            <span className="text-[10px] text-muted">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={toggleMute}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-[#f1f5f9] hover:text-ink transition-colors"
            aria-label={muted ? '取消静音' : '静音'}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            onClick={skipPrev}
            disabled={currentTrackIndex === 0 && playState === 'idle'}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-[#f1f5f9] hover:text-ink transition-colors disabled:opacity-30"
            aria-label="上一条"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            onClick={togglePlay}
            disabled={playState === 'loading'}
            className="grid h-11 w-11 place-items-center rounded-full bg-[#0891b2] text-white shadow-sm hover:bg-[#0e7490] active:scale-95 transition-all disabled:opacity-50"
            aria-label={playState === 'playing' ? '暂停' : '播放'}
          >
            {playState === 'loading' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : playState === 'playing' ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </button>

          <button
            onClick={skipNext}
            disabled={currentTrackIndex >= tracks.length - 1}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-[#f1f5f9] hover:text-ink transition-colors disabled:opacity-30"
            aria-label="下一条"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          <div className="w-8" />
        </div>

        {/* Error */}
        {error && (
          <p className="mt-3 rounded-[8px] bg-[#fef2f2] px-3 py-2 text-micro text-[#dc2626]">{error}</p>
        )}
      </div>

      {/* Track list */}
      {tracks.length > 1 && (
        <div className="border-t border-line px-5 py-3 max-h-[160px] overflow-y-auto bg-[#f9fafb]">
          <p className="text-micro font-bold text-muted mb-2">播放列表</p>
          <div className="space-y-1">
            {tracks.map((track, idx) => (
              <button
                key={track.id}
                onClick={() => playTrack(idx)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-left transition-colors',
                  idx === currentTrackIndex
                    ? 'bg-[#ecfeff] text-[#0891b2]'
                    : 'text-ink hover:bg-white',
                )}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] font-bold bg-[#f1f5f9]">
                  {idx === currentTrackIndex && playState === 'playing' ? '▶' : idx + 1}
                </span>
                <span className="text-small truncate flex-1">{track.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

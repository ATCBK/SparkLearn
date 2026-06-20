import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Fragment, useMemo } from 'react'
import './index.scss'

type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'code'; code: string; lang?: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'divider' }

type InlineToken =
  | { type: 'text'; content: string }
  | { type: 'strong'; content: string }
  | { type: 'em'; content: string }
  | { type: 'code'; content: string }
  | { type: 'image'; alt: string; url: string }
  | { type: 'link'; label: string; url: string }

const INLINE_TOKEN_PATTERN = /(!\[([^\]]*)\]\(([^)]+)\))|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(`([^`]+)`)|(\*\*([^*]+)\*\*)|(__(.+?)__)|(\*([^*\n]+)\*)|(_([^_\n]+)_)/g

function pushParagraph(blocks: MarkdownBlock[], lines: string[]) {
  const text = lines.join('\n').trim()
  if (text) blocks.push({ type: 'paragraph', text })
  lines.length = 0
}

function tokenizeInlineMarkdown(input: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let lastIndex = 0

  input.replace(INLINE_TOKEN_PATTERN, (...args) => {
    const match = args[0] as string
    const offset = args[args.length - 2] as number

    if (offset > lastIndex) {
      tokens.push({ type: 'text', content: input.slice(lastIndex, offset) })
    }

    const imageAlt = args[2] as string | undefined
    const imageUrl = args[3] as string | undefined
    const linkLabel = args[5] as string | undefined
    const linkUrl = args[6] as string | undefined
    const inlineCode = args[8] as string | undefined
    const strongAsterisk = args[10] as string | undefined
    const strongUnderline = args[12] as string | undefined
    const emphasisAsterisk = args[14] as string | undefined
    const emphasisUnderline = args[16] as string | undefined

    if (imageAlt !== undefined && imageUrl) {
      tokens.push({ type: 'image', alt: imageAlt, url: imageUrl })
    } else if (linkLabel && linkUrl) {
      tokens.push({ type: 'link', label: linkLabel, url: linkUrl })
    } else if (inlineCode) {
      tokens.push({ type: 'code', content: inlineCode })
    } else if (strongAsterisk || strongUnderline) {
      tokens.push({ type: 'strong', content: strongAsterisk || strongUnderline || match })
    } else if (emphasisAsterisk || emphasisUnderline) {
      tokens.push({ type: 'em', content: emphasisAsterisk || emphasisUnderline || match })
    } else {
      tokens.push({ type: 'text', content: match })
    }

    lastIndex = offset + match.length
    return match
  })

  if (lastIndex < input.length) {
    tokens.push({ type: 'text', content: input.slice(lastIndex) })
  }

  return tokens.length ? tokens : [{ type: 'text', content: input }]
}

export function parseMarkdownBlocks(input: string): MarkdownBlock[] {
  if (!input.trim()) return []

  const normalized = input.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  const blocks: MarkdownBlock[] = []
  const paragraphLines: string[] = []
  let index = 0

  while (index < lines.length) {
    const rawLine = lines[index]
    const trimmed = rawLine.trim()

    if (!trimmed) {
      pushParagraph(blocks, paragraphLines)
      index += 1
      continue
    }

    const codeFence = rawLine.match(/^```([\w-]+)?\s*$/)
    if (codeFence) {
      pushParagraph(blocks, paragraphLines)
      const codeLines: string[] = []
      const lang = codeFence[1]
      index += 1
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push({ type: 'code', code: codeLines.join('\n').replace(/\n+$/, ''), lang })
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      pushParagraph(blocks, paragraphLines)
      blocks.push({ type: 'divider' })
      index += 1
      continue
    }

    const heading = rawLine.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      pushParagraph(blocks, paragraphLines)
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() })
      index += 1
      continue
    }

    if (/^>\s?/.test(rawLine)) {
      pushParagraph(blocks, paragraphLines)
      const quoteLines: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, '').trim())
        index += 1
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n').trim() })
      continue
    }

    const unordered = rawLine.match(/^(\s*)[-*+]\s+(.+)$/)
    const ordered = rawLine.match(/^(\s*)\d+\.\s+(.+)$/)
    if (unordered || ordered) {
      pushParagraph(blocks, paragraphLines)
      const items: string[] = []
      const orderedList = Boolean(ordered)

      while (index < lines.length) {
        const candidate = lines[index]
        const nextUnordered = candidate.match(/^(\s*)[-*+]\s+(.+)$/)
        const nextOrdered = candidate.match(/^(\s*)\d+\.\s+(.+)$/)
        const nextMatch = orderedList ? nextOrdered : nextUnordered
        if (!nextMatch) break
        items.push(nextMatch[2].trim())
        index += 1
      }

      blocks.push({ type: 'list', ordered: orderedList, items })
      continue
    }

    paragraphLines.push(rawLine)
    index += 1
  }

  pushParagraph(blocks, paragraphLines)
  return blocks
}

function InlineMarkdown({ text }: { text: string }) {
  const tokens = useMemo(() => tokenizeInlineMarkdown(text), [text])

  const handleLinkPress = (url: string) => {
    Taro.setClipboardData({ data: url })
      .then(() => {
        Taro.showToast({ title: '链接已复制', icon: 'none' })
      })
      .catch(() => {
        Taro.showToast({ title: '无法处理链接', icon: 'none' })
      })
  }

  return (
    <View className='assistant-markdown__inline'>
      {tokens.map((token, index) => {
        const key = `${token.type}-${index}`
        if (token.type === 'strong') {
          return (
            <Text key={key} className='assistant-markdown__strong'>
              {token.content}
            </Text>
          )
        }

        if (token.type === 'em') {
          return (
            <Text key={key} className='assistant-markdown__em'>
              {token.content}
            </Text>
          )
        }

        if (token.type === 'code') {
          return (
            <Text key={key} className='assistant-markdown__inline-code'>
              {token.content}
            </Text>
          )
        }

        if (token.type === 'link') {
          return (
            <Text key={key} className='assistant-markdown__link' onClick={() => handleLinkPress(token.url)}>
              {token.label}
            </Text>
          )
        }

        if (token.type === 'image') {
          return (
            <View key={key} className='assistant-markdown__image-wrap'>
              <Image className='assistant-markdown__image' src={token.url} mode='widthFix' />
              {token.alt ? <Text className='assistant-markdown__image-caption'>{token.alt}</Text> : null}
            </View>
          )
        }

        return <Fragment key={key}>{token.content}</Fragment>
      })}
    </View>
  )
}

export default function MarkdownMessage({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdownBlocks(content), [content])

  if (!blocks.length) {
    return <Text className='assistant-markdown__fallback'>{content}</Text>
  }

  return (
    <View className='assistant-markdown'>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`

        if (block.type === 'heading') {
          return (
            <View key={key} className={`assistant-markdown__block assistant-markdown__heading assistant-markdown__heading--${Math.min(block.level, 3)}`}>
              <InlineMarkdown text={block.text} />
            </View>
          )
        }

        if (block.type === 'blockquote') {
          return (
            <View key={key} className='assistant-markdown__block assistant-markdown__quote'>
              <InlineMarkdown text={block.text} />
            </View>
          )
        }

        if (block.type === 'code') {
          return (
            <View key={key} className='assistant-markdown__block assistant-markdown__code-block'>
              {block.lang ? <Text className='assistant-markdown__code-lang'>{block.lang}</Text> : null}
              <ScrollView scrollX showScrollbar={false} className='assistant-markdown__code-scroll'>
                <Text className='assistant-markdown__code-text'>{block.code || ' '}</Text>
              </ScrollView>
            </View>
          )
        }

        if (block.type === 'list') {
          return (
            <View key={key} className='assistant-markdown__block assistant-markdown__list'>
              {block.items.map((item, itemIndex) => (
                <View key={`${key}-${itemIndex}`} className='assistant-markdown__list-item'>
                  <Text className='assistant-markdown__list-marker'>{block.ordered ? `${itemIndex + 1}.` : '-'}</Text>
                  <View className='assistant-markdown__list-content'>
                    <InlineMarkdown text={item} />
                  </View>
                </View>
              ))}
            </View>
          )
        }

        if (block.type === 'divider') {
          return <View key={key} className='assistant-markdown__divider' />
        }

        return (
          <View key={key} className='assistant-markdown__block assistant-markdown__paragraph'>
            <InlineMarkdown text={block.text} />
          </View>
        )
      })}
    </View>
  )
}

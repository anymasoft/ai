/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * xml-parser.ts
 * Copyright (C) 2025 Nextify Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 */

type NodeSchema = {
  isContentNode?: boolean
  hasCdata?: boolean
  allowedChildren?: string[]
  isStreaming?: boolean
}

const xmlSchema: Record<string, NodeSchema> = {
  plan: { isContentNode: false, hasCdata: false, isStreaming: false },
  action: { isContentNode: false, hasCdata: false, isStreaming: false },
  description: { isContentNode: true, hasCdata: true, isStreaming: false },
  file: { isContentNode: false, hasCdata: true, isStreaming: false },
  commandType: { isContentNode: true, hasCdata: false, isStreaming: false },
  package: { isContentNode: true, hasCdata: false, isStreaming: false },
  planDescription: { isContentNode: true, hasCdata: true, isStreaming: true },
  thinking: { isContentNode: true, hasCdata: true, isStreaming: true },
}

export type TagType = {
  name: string
  attributes: Record<string, string>
  content: string
  children: TagType[]
}

type TagCallbackType = (tag: TagType) => void
export type StreamingCallbackType = (tagName: string, content: string, isComplete: boolean) => void

export class StreamingXMLParser {
  private buffer = ''
  private currentTag: TagType | null = null
  private tagStack: TagType[] = []
  private isInCDATA = false
  private cdataBuffer = ''
  private textBuffer = ''
  private onTag: TagCallbackType
  private onStreaming?: StreamingCallbackType
  private streamingAccumulators: Map<string, string> = new Map()

  constructor({
    onTag,
    onStreaming,
  }: { onTag: TagCallbackType; onStreaming?: StreamingCallbackType }) {
    this.onTag = onTag
    // @ts-ignore
    this['onStreaming'] = onStreaming
  }

  private parseAttributes(attributeString: string): Record<string, string> {
    const attributes: Record<string, string> = {}
    const matches = attributeString.match(/(\w+)="([^"]*?)"/g)

    if (matches) {
      for (const match of matches) {
        const [key, value] = match.split('=') as [string, string]
        attributes[key] = value.replace(/"/g, '')
      }
    }

    return attributes
  }

  private handleOpenTag(tagContent: string) {
    if (this.textBuffer.trim()) {
      this.processTextContent(this.textBuffer.trim())
    }
    this.textBuffer = ''

    const spaceIndex = tagContent.indexOf(' ')
    const tagName = spaceIndex === -1 ? tagContent : tagContent.substring(0, spaceIndex)
    const attributeString = spaceIndex === -1 ? '' : tagContent.substring(spaceIndex + 1)

    const newTag: TagType = {
      name: tagName,
      attributes: this.parseAttributes(attributeString),
      content: '',
      children: [],
    }

    const schema = xmlSchema[tagName]
    if (schema?.isStreaming && this.onStreaming) {
      this.streamingAccumulators.set(tagName, '')
    }

    if (this.currentTag) {
      this.tagStack.push(this.currentTag)
      this.currentTag.children.push(newTag)
    }

    this.currentTag = newTag
  }

  private handleCloseTag(tagName: string) {
    if (!this.currentTag) {
      return
    }

    if (this.textBuffer.trim()) {
      this.processTextContent(this.textBuffer.trim())
    }
    this.textBuffer = ''

    if (this.currentTag.name !== tagName) {
      return
    }

    const schema = xmlSchema[this.currentTag.name]
    if (schema?.isStreaming && this.onStreaming) {
      const accumulatedContent = this.streamingAccumulators.get(this.currentTag.name) || ''
      this.currentTag.content = accumulatedContent
      this.onStreaming(this.currentTag.name, accumulatedContent, true)
      this.streamingAccumulators.delete(this.currentTag.name)
    }

    if (!schema?.isStreaming) {
      this.currentTag = this.cleanNode(this.currentTag)
      this.onTag(this.currentTag)
    }

    if (this.tagStack.length > 0) {
      this.currentTag = this.tagStack.pop() || null
    } else {
      this.currentTag = null
    }
  }

  private processTextContent(content: string) {
    if (!this.currentTag) return

    const schema = xmlSchema[this.currentTag.name]

    if (schema?.isStreaming && this.onStreaming) {
      const accumulated = this.streamingAccumulators.get(this.currentTag.name) || ''
      const newAccumulated = accumulated + content
      this.streamingAccumulators.set(this.currentTag.name, newAccumulated)

      this.onStreaming(this.currentTag.name, content, false)
    } else {
      this.currentTag.content += content
    }
  }

  private cleanNode(node: TagType): TagType {
    const schema = xmlSchema[node.name]

    const isContentNode = schema ? schema.isContentNode : true

    if (!isContentNode && node.children.length > 0) {
      node.content = ''
    }

    node.children = node.children.map((child) => this.cleanNode(child))

    return node
  }

  parse(chunk: string) {
    this.buffer += chunk

    while (this.buffer.length > 0) {
      if (this.isInCDATA) {
        const combinedBuffer = this.cdataBuffer + this.buffer
        const cdataEndIndex = combinedBuffer.indexOf(']]>')
        if (cdataEndIndex === -1) {
          this.cdataBuffer = combinedBuffer
          this.buffer = ''
          return
        }

        const cdataContent = combinedBuffer.substring(0, cdataEndIndex)
        if (this.currentTag) {
          this.processTextContent(cdataContent.trim())
        }

        this.isInCDATA = false
        this.cdataBuffer = ''
        this.buffer = combinedBuffer.substring(cdataEndIndex + 3)
        continue
      }

      const openTagStartIdx = this.buffer.indexOf('<')
      if (openTagStartIdx === -1) {
        if (this.buffer.trim()) {
          this.processTextContent(this.buffer)
        }
        this.buffer = ''
        return
      }

      if (openTagStartIdx > 0) {
        const textContent = this.buffer.substring(0, openTagStartIdx)
        if (textContent.trim()) {
          this.processTextContent(textContent)
        }
        this.buffer = this.buffer.substring(openTagStartIdx)
      }

      if (this.sequenceExistsAt('<![CDATA[', 0)) {
        const shouldProcessCDATA =
          this.currentTag?.name && xmlSchema[this.currentTag.name]?.hasCdata === true

        if (shouldProcessCDATA && this.currentTag) {
          this.isInCDATA = true
          const cdataStart = this.buffer.substring(9)
          this.cdataBuffer = cdataStart
          this.buffer = ''
          return
        }
        this.processTextContent('<![CDATA[')
        this.buffer = this.buffer.substring(9)
        continue
      }

      const openTagEndIdx = this.buffer.indexOf('>')
      if (openTagEndIdx === -1) {
        return
      }

      const tagContent = this.buffer.substring(1, openTagEndIdx)
      this.buffer = this.buffer.substring(openTagEndIdx + 1)

      if (tagContent.startsWith('/')) {
        this.handleCloseTag(tagContent.substring(1))
      } else {
        this.handleOpenTag(tagContent)
      }
    }
  }

  private sequenceExistsAt(sequence: string, idx: number, buffer: string = this.buffer) {
    for (let i = 0; i < sequence.length; i++) {
      if (buffer[idx + i] !== sequence[i]) {
        return false
      }
    }
    return true
  }
}

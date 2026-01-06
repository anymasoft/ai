import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib"

// Транслитерация кириллицы в латиницу (pdf-lib StandardFonts не поддерживают Unicode)
const CYRILLIC_TO_LATIN: Record<string, string> = {
  "А": "A", "Б": "B", "В": "V", "Г": "G", "Д": "D", "Е": "E", "Ё": "E",
  "Ж": "Zh", "З": "Z", "И": "I", "Й": "Y", "К": "K", "Л": "L", "М": "M",
  "Н": "N", "О": "O", "П": "P", "Р": "R", "С": "S", "Т": "T", "У": "U",
  "Ф": "F", "Х": "Kh", "Ц": "Ts", "Ч": "Ch", "Ш": "Sh", "Щ": "Shch",
  "Ъ": "", "Ы": "Y", "Ь": "", "Э": "E", "Ю": "Yu", "Я": "Ya",
  "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
  "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
  "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
  "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
  "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}

/**
 * Нормализация текста для PDF (транслитерация + очистка)
 * pdf-lib StandardFonts поддерживают только WinAnsi (Latin-1)
 */
export function normalizePDFText(text: string): string {
  if (!text) return ""

  let result = ""
  for (const char of text) {
    if (CYRILLIC_TO_LATIN[char] !== undefined) {
      result += CYRILLIC_TO_LATIN[char]
    } else {
      result += char
    }
  }

  return result
    // заменить длинные тире/эмдеш/эндаш
    .replace(/[\u2012-\u2015]/g, "-")
    // заменить кавычки на обычные
    .replace(/[«»""„]/g, '"')
    .replace(/['']/g, "'")
    // удалить emoji (pdf-lib их не поддерживает)
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    // очистить управляющие символы
    .replace(/[\x00-\x1F\x7F]/g, " ")
    // убрать множественные пробелы
    .replace(/\s+/g, " ")
    .trim()
}

// Цвета для PDF
const COLORS = {
  primary: rgb(0.2, 0.4, 0.8),
  secondary: rgb(0.4, 0.4, 0.4),
  text: rgb(0.1, 0.1, 0.1),
  muted: rgb(0.5, 0.5, 0.5),
  accent: rgb(0.9, 0.3, 0.3),
  success: rgb(0.2, 0.6, 0.3),
  border: rgb(0.85, 0.85, 0.85),
}

// Размеры страницы A4
const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 50
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

interface PDFBuilderOptions {
  title: string
  subtitle?: string
  generatedAt?: Date
}

/**
 * Утилита для создания PDF-документов
 */
export class PDFBuilder {
  private doc: PDFDocument
  private currentPage: PDFPage
  private yPosition: number
  private font: PDFFont
  private boldFont: PDFFont
  private options: PDFBuilderOptions

  private constructor(
    doc: PDFDocument,
    page: PDFPage,
    font: PDFFont,
    boldFont: PDFFont,
    options: PDFBuilderOptions
  ) {
    this.doc = doc
    this.currentPage = page
    this.yPosition = PAGE_HEIGHT - MARGIN
    this.font = font
    this.boldFont = boldFont
    this.options = options
  }

  static async create(options: PDFBuilderOptions): Promise<PDFBuilder> {
    const doc = await PDFDocument.create()
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

    const builder = new PDFBuilder(doc, page, font, boldFont, options)
    await builder.addHeader()

    return builder
  }

  private async addHeader() {
    const { title, subtitle, generatedAt } = this.options

    // Заголовок
    this.currentPage.drawText(normalizePDFText(title), {
      x: MARGIN,
      y: this.yPosition,
      size: 24,
      font: this.boldFont,
      color: COLORS.primary,
    })
    this.yPosition -= 35

    // Подзаголовок
    if (subtitle) {
      this.currentPage.drawText(normalizePDFText(subtitle), {
        x: MARGIN,
        y: this.yPosition,
        size: 12,
        font: this.font,
        color: COLORS.muted,
      })
      this.yPosition -= 20
    }

    // Дата генерации (en-US для совместимости с WinAnsi)
    const dateStr = (generatedAt || new Date()).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    this.currentPage.drawText(`Generated: ${dateStr}`, {
      x: MARGIN,
      y: this.yPosition,
      size: 10,
      font: this.font,
      color: COLORS.muted,
    })
    this.yPosition -= 15

    // Линия под заголовком
    this.currentPage.drawLine({
      start: { x: MARGIN, y: this.yPosition },
      end: { x: PAGE_WIDTH - MARGIN, y: this.yPosition },
      thickness: 1,
      color: COLORS.border,
    })
    this.yPosition -= 30
  }

  private checkNewPage(requiredSpace: number = 100) {
    if (this.yPosition < MARGIN + requiredSpace) {
      this.currentPage = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      this.yPosition = PAGE_HEIGHT - MARGIN
    }
  }

  /**
   * Добавить заголовок секции
   */
  addSectionTitle(title: string) {
    this.checkNewPage(60)
    this.yPosition -= 15

    this.currentPage.drawText(normalizePDFText(title), {
      x: MARGIN,
      y: this.yPosition,
      size: 16,
      font: this.boldFont,
      color: COLORS.primary,
    })
    this.yPosition -= 25
  }

  /**
   * Добавить подзаголовок
   */
  addSubtitle(text: string) {
    this.checkNewPage(40)

    this.currentPage.drawText(normalizePDFText(text), {
      x: MARGIN,
      y: this.yPosition,
      size: 12,
      font: this.boldFont,
      color: COLORS.text,
    })
    this.yPosition -= 20
  }

  /**
   * Добавить параграф текста с автоматическим переносом
   */
  addParagraph(text: string, options?: { indent?: number; color?: typeof COLORS.text }) {
    const normalizedText = normalizePDFText(text)
    const indent = options?.indent || 0
    const color = options?.color || COLORS.text
    const maxWidth = CONTENT_WIDTH - indent
    const fontSize = 11
    const lineHeight = 16

    // Разбиваем текст на слова
    const words = normalizedText.split(" ")
    let currentLine = ""

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const textWidth = this.font.widthOfTextAtSize(testLine, fontSize)

      if (textWidth > maxWidth && currentLine) {
        this.checkNewPage(lineHeight + 10)
        this.currentPage.drawText(currentLine, {
          x: MARGIN + indent,
          y: this.yPosition,
          size: fontSize,
          font: this.font,
          color,
        })
        this.yPosition -= lineHeight
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    // Последняя строка
    if (currentLine) {
      this.checkNewPage(lineHeight + 10)
      this.currentPage.drawText(currentLine, {
        x: MARGIN + indent,
        y: this.yPosition,
        size: fontSize,
        font: this.font,
        color,
      })
      this.yPosition -= lineHeight
    }

    this.yPosition -= 5
  }

  /**
   * Добавить список элементов
   */
  addList(items: string[], options?: { numbered?: boolean; bulletColor?: typeof COLORS.primary }) {
    const bulletColor = options?.bulletColor || COLORS.primary
    const numbered = options?.numbered || false

    items.forEach((item, index) => {
      this.checkNewPage(30)

      const normalizedItem = normalizePDFText(item)
      const bullet = numbered ? `${index + 1}.` : "-"

      this.currentPage.drawText(bullet, {
        x: MARGIN + 10,
        y: this.yPosition,
        size: 11,
        font: numbered ? this.boldFont : this.font,
        color: bulletColor,
      })

      // Текст элемента с переносом
      const maxWidth = CONTENT_WIDTH - 30
      const words = normalizedItem.split(" ")
      let currentLine = ""
      let isFirstLine = true

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const textWidth = this.font.widthOfTextAtSize(testLine, 11)

        if (textWidth > maxWidth && currentLine) {
          this.currentPage.drawText(currentLine, {
            x: MARGIN + (isFirstLine ? 25 : 25),
            y: this.yPosition,
            size: 11,
            font: this.font,
            color: COLORS.text,
          })
          this.yPosition -= 16
          this.checkNewPage(20)
          currentLine = word
          isFirstLine = false
        } else {
          currentLine = testLine
        }
      }

      if (currentLine) {
        this.currentPage.drawText(currentLine, {
          x: MARGIN + 25,
          y: this.yPosition,
          size: 11,
          font: this.font,
          color: COLORS.text,
        })
        this.yPosition -= 18
      }
    })

    this.yPosition -= 5
  }

  /**
   * Добавить таблицу
   */
  addTable(headers: string[], rows: string[][], options?: { columnWidths?: number[] }) {
    const columnWidths = options?.columnWidths || headers.map(() => CONTENT_WIDTH / headers.length)
    const rowHeight = 25
    const headerHeight = 30
    const fontSize = 10

    this.checkNewPage(headerHeight + rowHeight * Math.min(rows.length, 3) + 20)

    let xPos = MARGIN

    // Заголовки
    this.currentPage.drawRectangle({
      x: MARGIN,
      y: this.yPosition - headerHeight + 5,
      width: CONTENT_WIDTH,
      height: headerHeight,
      color: rgb(0.95, 0.95, 0.95),
    })

    headers.forEach((header, i) => {
      this.currentPage.drawText(normalizePDFText(header), {
        x: xPos + 5,
        y: this.yPosition - 15,
        size: fontSize,
        font: this.boldFont,
        color: COLORS.text,
      })
      xPos += columnWidths[i]
    })

    this.yPosition -= headerHeight

    // Строки
    rows.forEach((row, rowIndex) => {
      this.checkNewPage(rowHeight + 10)

      if (rowIndex % 2 === 1) {
        this.currentPage.drawRectangle({
          x: MARGIN,
          y: this.yPosition - rowHeight + 5,
          width: CONTENT_WIDTH,
          height: rowHeight,
          color: rgb(0.98, 0.98, 0.98),
        })
      }

      xPos = MARGIN
      row.forEach((cell, i) => {
        const normalizedCell = normalizePDFText(cell)
        const truncatedCell = normalizedCell.length > 40 ? normalizedCell.slice(0, 37) + "..." : normalizedCell
        this.currentPage.drawText(truncatedCell, {
          x: xPos + 5,
          y: this.yPosition - 15,
          size: fontSize,
          font: this.font,
          color: COLORS.text,
        })
        xPos += columnWidths[i]
      })

      this.yPosition -= rowHeight
    })

    this.yPosition -= 15
  }

  /**
   * Добавить разделитель
   */
  addDivider() {
    this.checkNewPage(20)
    this.yPosition -= 10

    this.currentPage.drawLine({
      start: { x: MARGIN, y: this.yPosition },
      end: { x: PAGE_WIDTH - MARGIN, y: this.yPosition },
      thickness: 0.5,
      color: COLORS.border,
    })

    this.yPosition -= 20
  }

  /**
   * Добавить отступ
   */
  addSpace(height: number = 20) {
    this.yPosition -= height
  }

  /**
   * Добавить блок с выделением (для важной информации)
   */
  addHighlightBox(title: string, content: string) {
    const normalizedTitle = normalizePDFText(title)
    const normalizedContent = normalizePDFText(content)
    const boxPadding = 15
    const contentLines = this.wrapText(normalizedContent, CONTENT_WIDTH - boxPadding * 2 - 10, 11)
    const boxHeight = 35 + contentLines.length * 16

    this.checkNewPage(boxHeight + 20)

    // Фон
    this.currentPage.drawRectangle({
      x: MARGIN,
      y: this.yPosition - boxHeight,
      width: CONTENT_WIDTH,
      height: boxHeight,
      color: rgb(0.95, 0.97, 1),
      borderColor: COLORS.primary,
      borderWidth: 1,
    })

    // Заголовок
    this.currentPage.drawText(normalizedTitle, {
      x: MARGIN + boxPadding,
      y: this.yPosition - 20,
      size: 12,
      font: this.boldFont,
      color: COLORS.primary,
    })

    // Контент
    let lineY = this.yPosition - 40
    contentLines.forEach((line) => {
      this.currentPage.drawText(line, {
        x: MARGIN + boxPadding,
        y: lineY,
        size: 11,
        font: this.font,
        color: COLORS.text,
      })
      lineY -= 16
    })

    this.yPosition -= boxHeight + 15
  }

  private wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    const words = text.split(" ")
    const lines: string[] = []
    let currentLine = ""

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const textWidth = this.font.widthOfTextAtSize(testLine, fontSize)

      if (textWidth > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }

    return lines
  }

  /**
   * Добавить футер на все страницы
   */
  addFooter() {
    const pages = this.doc.getPages()
    pages.forEach((page, index) => {
      const pageNumber = `Page ${index + 1} of ${pages.length}`
      page.drawText(pageNumber, {
        x: PAGE_WIDTH - MARGIN - this.font.widthOfTextAtSize(pageNumber, 9),
        y: 25,
        size: 9,
        font: this.font,
        color: COLORS.muted,
      })

      page.drawText("CardMaker - Товарные Карточки Маркетплейсов", {
        x: MARGIN,
        y: 25,
        size: 9,
        font: this.font,
        color: COLORS.muted,
      })
    })
  }

  /**
   * Получить PDF как Uint8Array
   */
  async build(): Promise<Uint8Array> {
    this.addFooter()
    return await this.doc.save()
  }
}

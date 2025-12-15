import { NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"

// Интерфейс для валидации данных
interface FeedbackData {
  firstName: string
  lastName: string
  email: string
  subject: string
  message: string
}

// Создание транспортера для отправки email
// Для локальной разработки может использоваться Ethereal email
// Для production - настроить реальный SMTP сервер
async function getTransporter() {
  // Проверяем наличие переменных окружения для SMTP
  if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: process.env.SMTP_SECURE === "true", // true для 465, false для других портов
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }

  // Для разработки используем Ethereal email (тестовый сервис)
  // В production нужно настроить реальный SMTP сервер
  const testAccount = await nodemailer.createTestAccount()
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body: FeedbackData = await request.json()

    // Валидация данных
    const { firstName, lastName, email, subject, message } = body

    if (!firstName || !lastName || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Все поля обязательны" },
        { status: 400 }
      )
    }

    // Валидация email формата
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Некорректный формат email" },
        { status: 400 }
      )
    }

    const transporter = await getTransporter()

    // Формирование HTML письма
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #0066cc; padding-bottom: 10px;">
          Новое сообщение обратной связи
        </h2>

        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Отправитель:</strong> ${firstName} ${lastName}</p>
          <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p><strong>Тема:</strong> ${subject}</p>
        </div>

        <div style="margin: 20px 0;">
          <h3 style="color: #333; margin-bottom: 10px;">Сообщение:</h3>
          <p style="white-space: pre-wrap; color: #555; line-height: 1.6;">
            ${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

        <p style="color: #999; font-size: 12px;">
          Это автоматическое письмо от системы обратной связи Beem Analytics.
          Пожалуйста, ответьте на адрес отправителя: ${email}
        </p>
      </div>
    `

    // Отправка письма админам
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@beem.ink",
      to: "support@beem.ink",
      subject: `[Обратная связь] ${subject}`,
      html: htmlContent,
      replyTo: email,
    })

    // Отправка подтверждающего письма пользователю
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@beem.ink",
      to: email,
      subject: "Ваше сообщение получено - Beem Analytics",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Спасибо за вашу обратную связь!</h2>

          <p>Здравствуйте, ${firstName}!</p>

          <p>Мы получили ваше сообщение и обязательно рассмотрим его. Наша команда ответит вам в течение 24 часов.</p>

          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Тема вашего сообщения:</strong> ${subject}</p>
            <p style="white-space: pre-wrap; color: #555; margin-top: 10px;">
              ${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
            </p>
          </div>

          <p>Если у вас есть срочные вопросы, свяжитесь с нами по email: <strong>support@beem.ink</strong></p>

          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            Это автоматическое письмо. Пожалуйста, не отвечайте на него.
          </p>
        </div>
      `,
    })

    return NextResponse.json(
      {
        success: true,
        message: "Ваше сообщение успешно отправлено",
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Feedback email error:", error)
    return NextResponse.json(
      {
        error: "Ошибка при отправке сообщения. Пожалуйста, попробуйте позже или напишите на support@beem.ink",
      },
      { status: 500 }
    )
  }
}

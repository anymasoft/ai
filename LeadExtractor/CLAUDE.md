# Project: LeadExtractor

## Goal
MVP сервис для извлечения контактов с сайтов:
input: список URL
output: таблица email + phone + source + CSV export

---

## Tech Stack

Frontend:
- React (Vite)
- Tailwind
- shadcn/ui

Backend:
- FastAPI
- Crawl4AI (основной crawler)
- asyncio

Database:
- PostgreSQL (будет позже)

Queue:
- пока НЕ используется (добавим позже)

---

## Current MVP Scope

Сейчас реализуем ТОЛЬКО:

- textarea с URL
- кнопка "Find Contacts"
- backend endpoint /extract
- crawler через Crawl4AI
- извлечение email (regex)
- извлечение телефонов (phonenumbers)
- таблица результатов
- экспорт CSV

---

## Explicit Constraints

НЕ использовать:

- Docker
- Celery
- theHarvester
- google-maps-scraper
- auth / billing

---

## Crawler Rules

- максимум 5 страниц на сайт
- сначала homepage
- затем contact/about страницы
- timeout 15 секунд

---

## Code Style

- простой код
- без лишних абстракций
- не создавать сложные архитектуры
- писать минимально необходимое

---

## UI Rules

- использовать структуру из business-leads-ai-automation
- стиль строго как LeadExtractor.html:
  - белый фон
  - #2563eb основной цвет
  - минимализм
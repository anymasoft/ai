#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FastAPI backend для dbgis — поиск и фильтрация компаний из 2ГИС.
PostgreSQL + HTML5 + Vanilla JS.
"""

import os
import csv
import io
from typing import Optional
from datetime import datetime

import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from jinja2 import Environment, FileSystemLoader
from dotenv import load_dotenv

# ============================================================
# ИНИЦИАЛИЗАЦИЯ
# ============================================================

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_NAME = os.getenv("DB_NAME", "dbgis")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", 8000))
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

app = FastAPI(title="dbgis API", debug=DEBUG)

# Jinja2 для шаблонов
templates_dir = os.path.join(os.path.dirname(__file__), "templates")
jinja_env = Environment(loader=FileSystemLoader(templates_dir))

# ============================================================
# DATABASE CONNECTION
# ============================================================

def get_db_connection():
    """Возвращает соединение с PostgreSQL."""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            cursor_factory=RealDictCursor
        )
        return conn
    except psycopg2.OperationalError as e:
        print(f"Ошибка подключения к БД: {e}")
        return None

# ============================================================
# API ENDPOINTS
# ============================================================

@app.get("/health")
async def health():
    """Проверка здоровья сервера и БД."""
    conn = get_db_connection()
    if conn is None:
        return {"status": "error", "message": "Database connection failed"}

    try:
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.close()
        conn.close()
        return {"status": "ok", "message": "API и БД работают"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/companies")
async def get_companies(
    city: Optional[str] = Query(None, description="Фильтр по городу (ILIKE)"),
    category: Optional[str] = Query(None, description="Фильтр по категории (ILIKE)"),
    has_email: Optional[bool] = Query(None, description="Только с email"),
    has_phone: Optional[bool] = Query(None, description="Только с телефоном"),
    has_website: Optional[bool] = Query(None, description="Только с сайтом"),
    limit: int = Query(50, ge=1, le=1000, description="Лимит результатов"),
    offset: int = Query(0, ge=0, description="Смещение")
):
    """Получить список компаний с фильтрами."""
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        cur = conn.cursor()

        # Базовый SELECT с JOIN для категорий
        query = """
            SELECT DISTINCT
                c.id,
                c.name,
                c.city,
                c.domain,
                c.website,
                c.created_at,
                COALESCE(
                    (SELECT STRING_AGG(p.phone, ', ')
                     FROM phones p
                     JOIN branches b ON p.branch_id = b.id
                     WHERE b.company_id = c.id), ''
                ) as phones,
                COALESCE(
                    (SELECT STRING_AGG(e.email, ', ')
                     FROM emails e
                     WHERE e.company_id = c.id), ''
                ) as emails,
                COALESCE(
                    (SELECT STRING_AGG(DISTINCT b.address, '; ')
                     FROM branches b
                     WHERE b.company_id = c.id
                       AND b.address IS NOT NULL AND b.address != ''), ''
                ) as address,
                COALESCE(
                    (SELECT STRING_AGG(s.type || ':' || s.url, ', ')
                     FROM socials s
                     WHERE s.company_id = c.id), ''
                ) as socials,
                STRING_AGG(DISTINCT cat.name, ', ') as categories
            FROM companies c
            LEFT JOIN company_categories cc ON c.id = cc.company_id
            LEFT JOIN categories cat ON cc.category_id = cat.id
            WHERE 1=1
        """

        params = []

        # Фильтры
        if city:
            query += " AND c.city ILIKE %s"
            params.append(f"%{city}%")

        if category:
            query += " AND cat.name ILIKE %s"
            params.append(f"%{category}%")

        if has_email:
            query += " AND EXISTS (SELECT 1 FROM emails WHERE company_id = c.id)"

        if has_phone:
            query += " AND EXISTS (SELECT 1 FROM phones p JOIN branches b ON p.branch_id = b.id WHERE b.company_id = c.id)"

        if has_website:
            query += " AND c.domain IS NOT NULL AND c.domain != ''"

        # Группировка и сортировка
        query += """
            GROUP BY c.id, c.name, c.city, c.domain, c.website, c.created_at
            ORDER BY c.name
            LIMIT %s OFFSET %s
        """
        params.append(limit)
        params.append(offset)

        cur.execute(query, params)
        rows = cur.fetchall()

        # Подсчёт общего количества
        count_query = """
            SELECT COUNT(DISTINCT c.id) as total
            FROM companies c
            LEFT JOIN company_categories cc ON c.id = cc.company_id
            LEFT JOIN categories cat ON cc.category_id = cat.id
            WHERE 1=1
        """

        count_params = []
        if city:
            count_query += " AND c.city ILIKE %s"
            count_params.append(f"%{city}%")

        if category:
            count_query += " AND cat.name ILIKE %s"
            count_params.append(f"%{category}%")

        if has_email:
            count_query += " AND EXISTS (SELECT 1 FROM emails WHERE company_id = c.id)"

        if has_phone:
            count_query += " AND EXISTS (SELECT 1 FROM phones p JOIN branches b ON p.branch_id = b.id WHERE b.company_id = c.id)"

        if has_website:
            count_query += " AND c.domain IS NOT NULL AND c.domain != ''"

        cur.execute(count_query, count_params)
        total = cur.fetchone()["total"]

        cur.close()
        conn.close()

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "data": [dict(row) for row in rows]
        }

    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/companies/{company_id}")
async def get_company_detail(company_id: int):
    """Получить полную информацию о компании."""
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        cur = conn.cursor()

        # Информация о компании
        cur.execute(
            "SELECT * FROM companies WHERE id = %s",
            (company_id,)
        )
        company = cur.fetchone()

        if not company:
            raise HTTPException(status_code=404, detail="Компания не найдена")

        company_dict = dict(company)

        # Филиалы
        cur.execute(
            "SELECT * FROM branches WHERE company_id = %s ORDER BY address",
            (company_id,)
        )
        branches = [dict(row) for row in cur.fetchall()]

        # Телефоны для каждого филиала
        for branch in branches:
            cur.execute(
                "SELECT phone FROM phones WHERE branch_id = %s",
                (branch["id"],)
            )
            branch["phones"] = [row["phone"] for row in cur.fetchall()]

        # Email
        cur.execute(
            "SELECT email FROM emails WHERE company_id = %s",
            (company_id,)
        )
        emails = [row["email"] for row in cur.fetchall()]

        # Категории
        cur.execute("""
            SELECT cat.id, cat.name, cat.parent_id
            FROM categories cat
            JOIN company_categories cc ON cat.id = cc.category_id
            WHERE cc.company_id = %s
        """, (company_id,))
        categories = [dict(row) for row in cur.fetchall()]

        # Соцсети (группируем по типу, у одного типа может быть несколько URL)
        cur.execute(
            "SELECT type, url FROM socials WHERE company_id = %s ORDER BY type",
            (company_id,)
        )
        socials = {}
        for row in cur.fetchall():
            stype = row["type"]
            if stype not in socials:
                socials[stype] = []
            socials[stype].append(row["url"])

        cur.close()
        conn.close()

        return {
            "company": company_dict,
            "branches": branches,
            "emails": emails,
            "categories": categories,
            "socials": socials
        }

    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/export")
async def export_csv(
    city: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    has_email: Optional[bool] = Query(None),
    has_phone: Optional[bool] = Query(None),
    has_website: Optional[bool] = Query(None),
    limit: int = Query(5000, ge=1, le=50000)
):
    """Экспорт результатов в CSV."""
    conn = get_db_connection()
    if conn is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        cur = conn.cursor()

        query = """
            SELECT DISTINCT
                c.id,
                c.name,
                c.city,
                c.domain,
                c.website,
                COALESCE(
                    (SELECT STRING_AGG(p.phone, ', ')
                     FROM phones p
                     JOIN branches b ON p.branch_id = b.id
                     WHERE b.company_id = c.id), ''
                ) as phones,
                COALESCE(
                    (SELECT STRING_AGG(e.email, ', ')
                     FROM emails e
                     WHERE e.company_id = c.id), ''
                ) as emails,
                COALESCE(
                    (SELECT STRING_AGG(DISTINCT b.address, '; ')
                     FROM branches b
                     WHERE b.company_id = c.id
                       AND b.address IS NOT NULL AND b.address != ''), ''
                ) as address,
                COALESCE(
                    (SELECT STRING_AGG(s.type || ':' || s.url, ', ')
                     FROM socials s
                     WHERE s.company_id = c.id), ''
                ) as socials,
                STRING_AGG(DISTINCT cat.name, ', ') as categories
            FROM companies c
            LEFT JOIN company_categories cc ON c.id = cc.company_id
            LEFT JOIN categories cat ON cc.category_id = cat.id
            WHERE 1=1
        """

        params = []

        if city:
            query += " AND c.city ILIKE %s"
            params.append(f"%{city}%")

        if category:
            query += " AND cat.name ILIKE %s"
            params.append(f"%{category}%")

        if has_email:
            query += " AND EXISTS (SELECT 1 FROM emails WHERE company_id = c.id)"

        if has_phone:
            query += " AND EXISTS (SELECT 1 FROM phones p JOIN branches b ON p.branch_id = b.id WHERE b.company_id = c.id)"

        if has_website:
            query += " AND c.domain IS NOT NULL AND c.domain != ''"

        query += " GROUP BY c.id, c.name, c.city, c.domain, c.website ORDER BY c.name LIMIT %s"
        params.append(limit)

        cur.execute(query, params)
        rows = cur.fetchall()
        cur.close()
        conn.close()

        # Формирование CSV
        output = io.StringIO()
        writer = csv.writer(output)

        # Заголовки
        writer.writerow(["ID", "Название", "Город", "Домен", "Сайт",
                         "Телефоны", "Email", "Адрес", "Соцсети", "Категории"])

        # Данные
        for row in rows:
            writer.writerow([
                row["id"],
                row["name"],
                row["city"] or "",
                row["domain"] or "",
                row["website"] or "",
                row["phones"] or "",
                row["emails"] or "",
                row["address"] or "",
                row["socials"] or "",
                row["categories"] or ""
            ])

        # Возврат как файл
        output.seek(0)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"dbgis_export_{timestamp}.csv"

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        if conn:
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================
# WEB UI
# ============================================================

@app.get("/", response_class=HTMLResponse)
async def index():
    """Главная страница с UI для поиска."""
    try:
        template = jinja_env.get_template("index.html")
        return template.render()
    except Exception as e:
        return f"<h1>Ошибка загрузки шаблона:</h1><p>{e}</p>"

# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=API_HOST,
        port=API_PORT,
        reload=DEBUG
    )

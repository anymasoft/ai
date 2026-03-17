FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc g++ libpq-dev wget && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir playwright && \
    playwright install --with-deps chromium

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH=/app
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lead_extractor
ENV REDIS_URL=redis://localhost:6379/0

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

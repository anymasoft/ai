"""
JobRadar v0 - ORM модели для SQLite
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, BigInteger, UniqueConstraint, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()


class User(Base):
    """Модель пользователя системы"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    phone = Column(String(20), unique=True, nullable=False)  # Нормализованный номер телефона
    disabled = Column(Boolean, default=False)  # Отключен ли пользователь (soft delete)
    plan = Column(String(50), default="trial")  # Тарифный план (trial, start, pro, business, expired)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Поля для управления сроками
    trial_given = Column(Boolean, default=False)  # Был ли уже выдан trial
    trial_expires_at = Column(DateTime, nullable=True)  # Когда закончится trial (now + 3 дня)
    paid_until = Column(DateTime, nullable=True)  # Когда закончится платный тариф (now + 30 дней)

    # Поле для авторизации
    auth_token = Column(String(128), unique=True, index=True, nullable=True)  # Криптографически стойкий токен сессии

    def __repr__(self):
        return f"<User(id={self.id}, phone={self.phone}, plan={self.plan}, trial_expires_at={self.trial_expires_at}, paid_until={self.paid_until})>"


class Channel(Base):
    """Модель канала для мониторинга"""
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True)
    kind = Column(String(50), default="username")  # "username" или "id"
    value = Column(String(255), nullable=False)  # username (без @) или numeric id
    channel_id = Column(Integer, nullable=True)  # Numeric ID канала (для Telethon)
    title = Column(String(255), nullable=True)  # Название канала
    username = Column(String(255), nullable=True)  # Username канала (без @)
    enabled = Column(Boolean, default=True)
    last_message_id = Column(Integer, default=0)  # Последний обработанный ID сообщения
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        display = f"@{self.value}" if self.kind == "username" else f"id:{self.value}"
        return f"<Channel(id={self.id}, {display}, title={self.title}, enabled={self.enabled})>"


class Keyword(Base):
    """Модель ключевого слова для поиска"""
    __tablename__ = "keywords"

    id = Column(Integer, primary_key=True)
    word = Column(String(255), unique=True, nullable=False)  # Может быть словом или фразой
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Keyword(id={self.id}, word={self.word}, enabled={self.enabled})>"


class SourceMessage(Base):
    """Модель для отслеживания обработанных сообщений из источников (backfill)"""
    __tablename__ = "source_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_chat_id = Column(BigInteger, nullable=False)
    source_message_id = Column(Integer, nullable=False)
    text = Column(String(4000), nullable=True)
    has_keywords = Column(Boolean, nullable=False, default=False)
    published = Column(Boolean, nullable=False, default=False)
    checked_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)
    source_channel_username = Column(String(255), nullable=True)

    __table_args__ = (
        UniqueConstraint('source_chat_id', 'source_message_id', name='uq_source_message'),
    )

    def __repr__(self):
        return f"<SourceMessage(id={self.id}, chat_id={self.source_chat_id}, msg_id={self.source_message_id}, has_keywords={self.has_keywords}, published={self.published})>"


class FilterRule(Base):
    """Модель правила фильтрации сообщений"""
    __tablename__ = "filter_rules"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    mode = Column(String(50), default="keyword_or")  # "keyword_or" или "advanced"
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<FilterRule(id={self.id}, name={self.name}, mode={self.mode}, enabled={self.enabled})>"


class FilterTerm(Base):
    """Модель термина фильтра"""
    __tablename__ = "filter_terms"

    id = Column(Integer, primary_key=True)
    rule_id = Column(Integer, ForeignKey("filter_rules.id"), nullable=False)
    term_type = Column(String(50), nullable=False)  # "include", "require", "exclude"
    value = Column(String(255), nullable=False)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<FilterTerm(id={self.id}, rule_id={self.rule_id}, type={self.term_type}, value={self.value}, enabled={self.enabled})>"


class Task(Base):
    """Модель задачи мониторинга для MVP Dashboard"""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Владелец задачи
    name = Column(String(255), nullable=False)
    status = Column(String(50), default="running")  # "running" или "paused"
    sources = Column(String(4000), nullable=False, default="")  # JSON или newline-separated
    include_keywords = Column(String(4000), nullable=False, default="")  # JSON или newline-separated
    exclude_keywords = Column(String(4000), nullable=True, default="")  # JSON или newline-separated
    forward_channel = Column(String(255), nullable=True, default="")  # legacy, не используется в текущей архитектуре
    alerts_personal = Column(Boolean, default=True)  # legacy, не используется в текущей архитектуре (используется telegram_sessions.alerts_personal)
    alerts_channel = Column(Boolean, default=False)  # legacy, не используется в текущей архитектуре
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Task(id={self.id}, user_id={self.user_id}, name={self.name}, status={self.status})>"


class Lead(Base):
    """Модель найденного лида из мониторинга"""
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)  # Ссылка на Task
    text = Column(Text, nullable=False)  # Полный текст сообщения
    source_channel = Column(String(255), nullable=False)  # Канал-источник (@username)
    source_message_id = Column(BigInteger, nullable=False)  # ID сообщения в источнике
    source_url = Column(String(255), nullable=True)  # Ссылка на оригинальный пост (https://t.me/...)
    matched_keyword = Column(String(255), nullable=True)  # Какое ключевое слово совпало
    found_at = Column(DateTime, default=datetime.utcnow)  # Когда найдено
    delivered_at = Column(DateTime, nullable=True)  # Когда доставлено пользователю
    status = Column(String(50), default="new")  # "new" или "viewed"
    is_read = Column(Boolean, default=False)  # Прочитан ли лид

    def __repr__(self):
        return f"<Lead(id={self.id}, task_id={self.task_id}, source={self.source_channel}, is_read={self.is_read})>"


class TaskSourceState(Base):
    """Модель состояния источника для задачи (отслеживание last_message_id и status)"""
    __tablename__ = "task_source_states"

    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)  # Ссылка на Task
    source = Column(String(255), nullable=False)  # Нормализованный username источника (без @)
    last_message_id = Column(BigInteger, default=0)  # Последний обработанный message_id
    initialized_at = Column(DateTime, default=datetime.utcnow)  # Когда была инициализирована позиция
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Состояние источника
    status = Column(String(50), default="ok")  # "ok" | "invalid" | "error"
    last_error = Column(Text, nullable=True)  # Текст последней ошибки
    error_count = Column(Integer, default=0)  # Количество ошибок подряд
    next_retry_at = Column(DateTime, nullable=True)  # Когда повторить попытку (для backoff)

    __table_args__ = (
        UniqueConstraint('task_id', 'source', name='uq_task_source'),
    )

    def __repr__(self):
        return f"<TaskSourceState(id={self.id}, task_id={self.task_id}, source={self.source}, status={self.status}, last_message_id={self.last_message_id})>"


class TelegramSession(Base):
    """Модель сессии Telegram для Userbot авторизации"""
    __tablename__ = "telegram_sessions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)  # Владелец сессии (один User = одна сессия)
    phone = Column(String(20), unique=True, nullable=False)  # Номер телефона
    session_string = Column(Text, nullable=False)  # StringSession строка (текст)
    telegram_user_id = Column(BigInteger, nullable=True)  # Telegram ID пользователя
    telegram_username = Column(String(255), nullable=True)  # Telegram @username пользователя (без @)
    alerts_personal = Column(Boolean, default=True)  # Присылать лиды в личный чат
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<TelegramSession(id={self.id}, user_id={self.user_id}, phone={self.phone}, telegram_id={self.telegram_user_id})>"


class Payment(Base):
    """Модель платежа через YooKassa"""
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Пользователь, оплативший
    plan = Column(String(50), nullable=False)  # Тарифный план (start, pro, business)
    amount = Column(String(10), nullable=False)  # Сумма (990.00, 1990.00, 4990.00)
    yookassa_payment_id = Column(String(255), unique=True, nullable=False)  # ID платежа в YooKassa
    status = Column(String(50), default="pending")  # pending | succeeded | canceled
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Поля для управления сроками и идемпотентностью
    activated_at = Column(DateTime, nullable=True)  # Когда платеж был активирован (succeeded)
    expires_at = Column(DateTime, nullable=True)  # Когда закончится этот платёж (activated_at + 30 дней)
    idempotence_key = Column(String(255), unique=True, nullable=True)  # Для защиты от дублей платежей

    def __repr__(self):
        return f"<Payment(id={self.id}, user_id={self.user_id}, plan={self.plan}, status={self.status}, expires_at={self.expires_at}, yookassa_id={self.yookassa_payment_id})>"

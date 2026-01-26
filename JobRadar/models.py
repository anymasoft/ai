"""
JobRadar v0 - ORM модели для SQLite
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, BigInteger, UniqueConstraint, Index, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()


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
        Index('idx_source_chat_message', 'source_chat_id', 'source_message_id'),
        Index('idx_published', 'published'),
    )

    def __repr__(self):
        return f"<SourceMessage(id={self.id}, chat_id={self.source_chat_id}, msg_id={self.source_message_id}, has_keywords={self.has_keywords}, published={self.published})>"


class FilterRule(Base):
    """Модель правила фильтрации сообщений"""
    __tablename__ = "filter_rules"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    mode = Column(String(50), default="legacy_or")  # "legacy_or" или "advanced"
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

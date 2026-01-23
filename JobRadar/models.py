"""
JobRadar v0 - ORM модели для SQLite
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()


class Channel(Base):
    """Модель канала для мониторинга"""
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True)
    kind = Column(String(50), default="username")  # "username" или "id"
    value = Column(String(255), nullable=False)  # username (без @) или numeric id
    username = Column(String(255), unique=True, nullable=True)  # DEPRECATED: для обратной совместимости
    enabled = Column(Boolean, default=True)
    last_message_id = Column(Integer, default=0)  # Последний обработанный ID сообщения
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        display = f"@{self.value}" if self.kind == "username" else f"id:{self.value}"
        return f"<Channel(id={self.id}, {display}, enabled={self.enabled})>"


class Keyword(Base):
    """Модель ключевого слова для поиска"""
    __tablename__ = "keywords"

    id = Column(Integer, primary_key=True)
    word = Column(String(255), unique=True, nullable=False)  # Может быть словом или фразой
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Keyword(id={self.id}, word={self.word}, enabled={self.enabled})>"

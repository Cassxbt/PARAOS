"""
Database layer for Parallax Translator
Handles SQLite persistence using SQLAlchemy and aiosqlite
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
import os

# Database configuration
DATABASE_URL = "sqlite+aiosqlite:///./translation.db"

# SQLAlchemy setup
Base = declarative_base()
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


class TranslationModel(Base):
    """SQLAlchemy model for translation history"""
    __tablename__ = "translations"

    id = Column(Integer, primary_key=True, index=True)
    source_text = Column(String, nullable=False)
    translated_text = Column(String, nullable=False)
    source_lang = Column(String, nullable=False)
    target_lang = Column(String, nullable=False)
    inference_time_ms = Column(Integer, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    model = Column(String, default="unknown")


async def init_db():
    """Initialize database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """Dependency for getting async session"""
    async with AsyncSessionLocal() as session:
        yield session


async def add_translation(
    session: AsyncSession,
    source_text: str,
    translated_text: str,
    source_lang: str,
    target_lang: str,
    inference_time_ms: int,
    model: str = "unknown"
):
    """Add a new translation record"""
    db_item = TranslationModel(
        source_text=source_text,
        translated_text=translated_text,
        source_lang=source_lang,
        target_lang=target_lang,
        inference_time_ms=inference_time_ms,
        model=model,
        timestamp=datetime.utcnow()
    )
    session.add(db_item)
    await session.commit()
    await session.refresh(db_item)
    return db_item


async def get_recent_translations(session: AsyncSession, limit: int = 50):
    """Get recent translations ordered by timestamp desc"""
    from sqlalchemy import select
    
    result = await session.execute(
        select(TranslationModel)
        .order_by(TranslationModel.timestamp.desc())
        .limit(limit)
    )
    return result.scalars().all()


async def clear_all_history(session: AsyncSession):
    """Clear all translation history"""
    from sqlalchemy import delete
    await session.execute(delete(TranslationModel))
    await session.commit()

# db.py — работа с базой данных PostgreSQL

import os
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, JSON, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

# Получаем URL базы данных из переменных окружения
DATABASE_URL = os.getenv('DATABASE_URL')

# Если база не создана — используем SQLite для локальной разработки
if not DATABASE_URL:
    print("⚠️ DATABASE_URL не найден, использую SQLite (только для разработки)")
    DATABASE_URL = 'sqlite:///requests.db'

# Создаём подключение
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class ValuationRequest(Base):
    """Модель для хранения запросов на оценку"""
    __tablename__ = 'valuation_requests'
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    ip = Column(String(50), nullable=True)
    
    # Параметры объекта
    area = Column(Float)
    build_year = Column(Integer)
    object_type = Column(String(100))
    city = Column(String(100))
    cadastral_price = Column(Float, nullable=True)
    wall_material = Column(String(50), nullable=True)
    object_name = Column(String(200), nullable=True)
    purpose = Column(String(200), nullable=True)
    permitted_use = Column(String(200), nullable=True)
    land_category = Column(String(200), nullable=True)
    cadastral_number = Column(String(50), nullable=True)
    
    # Результаты
    result_price_per_sqm = Column(Float)
    result_price_total = Column(Float)
    method = Column(String(200), nullable=True)
    analogs = Column(JSON, nullable=True)
    percent_diff = Column(Float, nullable=True)
    ratio_to_ks = Column(Float, nullable=True)
    ks_used = Column(Float, nullable=True)
    ks_provided = Column(String(10), nullable=True)

# Создаём таблицы
def init_db():
    Base.metadata.create_all(bind=engine)
    print("✅ Таблицы созданы")

def get_db():
    """Возвращает сессию для работы с БД"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 🔥 НОВАЯ ФУНКЦИЯ: безопасное сохранение запроса
def save_request(data):
    """Сохраняет запрос в БД и возвращает ID"""
    db = SessionLocal()
    try:
        valuation = ValuationRequest(**data)
        db.add(valuation)
        db.commit()
        db.refresh(valuation)  # 🔥 Обновляем объект, чтобы получить ID
        request_id = valuation.id
        return request_id
    except Exception as e:
        db.rollback()
        print(f"⚠️ Ошибка сохранения в БД: {e}")
        return None
    finally:
        db.close()

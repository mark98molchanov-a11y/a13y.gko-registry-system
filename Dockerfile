FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 🔥 КОПИРУЕМ ФАЙЛЫ ИЗ КОРНЯ
COPY *.pkl ./
COPY *.py ./
COPY *.json ./

# 🔥🔥🔥 КОПИРУЕМ ВСЮ ПАПКУ models/ (ЕСЛИ ОНА ЕСТЬ)
COPY models/ ./models/

EXPOSE 8080

CMD ["gunicorn", "wsgi:app", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "2", "--access-logfile", "-", "--error-logfile", "-"]

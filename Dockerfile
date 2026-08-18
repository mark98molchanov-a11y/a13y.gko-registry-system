FROM python:3.10-slim

WORKDIR /app

# 🔥 КОПИРУЕМ ВСЁ НУЖНОЕ
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 🔥🔥🔥 ЯВНО КОПИРУЕМ ВСЕ .pkl ФАЙЛЫ
COPY *.pkl ./
COPY *.py ./
COPY *.json ./

EXPOSE 8080

CMD ["gunicorn", "wsgi:app", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "2", "--access-logfile", "-", "--error-logfile", "-"]

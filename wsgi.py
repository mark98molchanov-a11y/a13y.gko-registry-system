import sys
print("🔥🔥🔥 WSGI.PY ЗАПУЩЕН!", flush=True)
sys.stdout.flush()

from app import app

print("✅ WSGI: app импортирован!", flush=True)
sys.stdout.flush()

if __name__ == "__main__":
    app.run()

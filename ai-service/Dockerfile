FROM python:3.12-slim

WORKDIR /service

# Install dependencies first (layer cache friendly)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and the trained model
COPY app/ ./app/
COPY app/eta_model.joblib ./app/eta_model.joblib

EXPOSE 8000

# Run as a module so relative imports in app/ work correctly
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

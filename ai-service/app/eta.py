import joblib
import pandas as pd
from pathlib import Path
from .models import ETARequest

MODEL_PATH = Path(__file__).parent / "eta_model.joblib"
model = joblib.load(MODEL_PATH)

def predict_eta(request: ETARequest) -> float:
    input_df = pd.DataFrame([{
        "route_id": request.route_id,
        "vehicle_type": request.vehicle_type,
        "hour_of_day": request.hour_of_day,
        "day_of_week": request.day_of_week,
        "distance_km": request.distance_km,
    }])

    prediction = model.predict(input_df)[0]
    return round(float(prediction), 2)
		
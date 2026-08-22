from fastapi import FastAPI
from .models import RadarRequest, RadarResponse, ETARequest, ETAResponse
from .radar import find_nearby_vehicles
from .eta import predict_eta

app = FastAPI()

@app.post("/radar", response_model=RadarResponse)
def commuter_radar(request: RadarRequest):
	nearby = find_nearby_vehicles(request)
	return RadarResponse(nearby_vehicles=nearby)

@app.post("/eta", response_model=ETAResponse)
def eta_prediction(request: ETARequest):
	predicted_minutes = predict_eta(request)
	return ETAResponse(predicted_travel_time_minutes=predicted_minutes)
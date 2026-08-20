from fastapi import FastAPI
from .models import RadarRequest, RadarResponse
from .radar import find_nearby_vehicles

app = FastAPI()

@app.post("/radar", response_model=RadarResponse)
def commuter_radar(request: RadarRequest):
    nearby = find_nearby_vehicles(request)
    return RadarResponse(nearby_vehicles=nearby)
from pydantic import BaseModel

class Coordinates(BaseModel):
	lat: float
	lng: float

class Vehicle(BaseModel):
	vehicle_id: str
	vehicle_type: str
	curr_position: Coordinates

class RadarRequest(BaseModel):
	commuter_location: Coordinates
	radius_km: float
	candidate_vehicles: list[Vehicle]

class RadarResult(BaseModel):
	vehicle_id: str
	vehicle_type: str
	distance_km: float

class RadarResponse(BaseModel):
	nearby_vehicles: list[RadarResult]

class ETARequest(BaseModel):
	route_id: int
	vehicle_type: str
	hour_of_day: int
	day_of_week: str
	distance_km: float

class ETAResponse(BaseModel):
	predicted_travel_time_minutes: float
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
import csv
import random

# Config: reproducible randomness for consistent demo results
random.seed(42)

VEHICLE_TYPES = ["jeepney", "e-jeep", "bus"]
ROUTE_IDS = [1, 2, 3]  # match your seeded route IDs
ROWS_TO_GENERATE = 2000

# Base average speed (km/h) per vehicle type, before adjustments
BASE_SPEED = {
    "jeepney": 18,
    "e-jeep": 20,
    "bus": 15,  # buses are generally slower (more stops, bigger vehicle)
}

def is_rush_hour(hour: int) -> bool:
    return (7 <= hour <= 9) or (16 <= hour <= 19)

def speed_multiplier(hour: int, day_of_week: str) -> float:
    """Returns a multiplier applied to base speed based on time patterns."""
    multiplier = 1.0

    if is_rush_hour(hour):
        multiplier *= 0.55  # significant slowdown during rush hour
    elif 22 <= hour or hour <= 5:
        multiplier *= 1.25  # faster late at night, empty roads

    if day_of_week in ["saturday", "sunday"]:
        multiplier *= 1.15  # weekends generally lighter traffic

    # Add small random noise so it's not perfectly deterministic
    multiplier *= random.uniform(0.92, 1.08)

    return multiplier

def generate_row():
    vehicle_type = random.choice(VEHICLE_TYPES)
    route_id = random.choice(ROUTE_IDS)
    hour_of_day = random.randint(0, 23)
    day_of_week = random.choice(
        ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    )
    distance_km = round(random.uniform(0.3, 8.0), 2)

    base_speed = BASE_SPEED[vehicle_type]
    actual_speed = base_speed * speed_multiplier(hour_of_day, day_of_week)

    # travel time in minutes = (distance / speed) * 60
    travel_time_minutes = round((distance_km / actual_speed) * 60, 2)

    return {
        "route_id": route_id,
        "vehicle_type": vehicle_type,
        "hour_of_day": hour_of_day,
        "day_of_week": day_of_week,
        "distance_km": distance_km,
        "actual_travel_time_minutes": travel_time_minutes,
    }

def main():
    rows = [generate_row() for _ in range(ROWS_TO_GENERATE)]

    with open("training_data.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated {len(rows)} rows -> training_data.csv")

if __name__ == "__main__":
    main()
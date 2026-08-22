import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
import joblib

#Load training data
df = pd.read_csv('training_data.csv')

#Define features (inputs) and target (prediction)
FEATURES = ["route_id", "vehicle_type", "hour_of_day", "day_of_week", "distance_km"]
TARGET = "actual_travel_time_minutes"

X = df[FEATURES]
y = df[TARGET]

#Split into train sets (80% train, 20% test — to check accuracy honestly)
X_train, X_test, y_train, y_test = train_test_split(
	X, y, test_size=0.2, random_state=42
)

#Categorial columns that needs to be encoded
categorical_features = ["vehicle_type", "day_of_week"]
numeric_features = ["route_id", "hour_of_day", "distance_km"]

preprocessor = ColumnTransformer(
	transformers=[
		("cat", OneHotEncoder(handle_unknown='ignore'), categorical_features)
	],
	remainder='passthrough'
)

#Pipeline: preprocessing + model together
model = Pipeline(steps=[
	("preprocessor", preprocessor),
	("regressor", RandomForestRegressor(n_estimators=100, random_state=42)),
])

#Training the model
model.fit(X_train, y_train)

#Evaluation
predictions = model.predict(X_test)
mae = mean_absolute_error(y_test, predictions)
print(f"Mean Absolute Error: {mae:.2f} minutes")

#Save the trained model to disk
joblib.dump(model, "eta_model.joblib")
print("Model saved to eta_model.joblib")
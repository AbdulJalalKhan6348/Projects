import os
import requests
from dotenv import load_dotenv
from pathlib import Path

# Load API key
load_dotenv(Path(__file__).with_name(".env"))

api_key = (os.getenv("WEATHER_API_KEY") or "").strip()

# Check key without revealing it
print("API key loaded:", bool(api_key))
print("API key length:", len(api_key))

if not api_key or api_key in (
    "YOUR_NEW_API_KEY",
    "PASTE_YOUR_API_KEY_HERE"
):
    print("ERROR: Please enter your actual API key in .env")

else:
    try:
        response = requests.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={
                "q": "Lahore,PK",
                "appid": api_key,
                "units": "metric"
            },
            timeout=15
        )

        print("HTTP Status:", response.status_code)

        if response.status_code == 200:
            data = response.json()
            print("Weather API authentication successful!")
            print("City:", data["name"])
            print("Temperature:", data["main"]["temp"], "°C")
            print("Condition:", data["weather"][0]["description"])

        else:
            print("API Error:", response.json().get("message"))

    except requests.RequestException as error:
        print("Connection error:", error)

import speech_recognition as sr
import pyttsx3
import datetime
import webbrowser
import re
import os
import requests

from pathlib import Path
from urllib.parse import quote_plus
from datetime import timedelta
from dotenv import load_dotenv


# =====================================
# LOAD ENVIRONMENT VARIABLES
# =====================================

load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")


# =====================================
# INITIALIZE VOICE ASSISTANT
# =====================================

recognizer = sr.Recognizer()

speaker = pyttsx3.init()

speaker.setProperty("rate", 170)
speaker.setProperty("volume", 1.0)

# Store reminders in memory
reminders = []


# =====================================
# TEXT TO SPEECH
# =====================================

def speak(message):

    print("Assistant:", message)

    speaker.say(message)
    speaker.runAndWait()


# =====================================
# VOICE RECOGNITION
# =====================================

def listen():

    try:

        with sr.Microphone() as source:

            print("\nListening... Speak now!")

            audio = recognizer.listen(
                source,
                timeout=5,
                phrase_time_limit=8
            )

        print("Recognizing your voice...")

        command = recognizer.recognize_google(
            audio,
            language="en-US"
        )

        print("You:", command)

        return command.lower().strip()

    except sr.WaitTimeoutError:

        return ""

    except sr.UnknownValueError:

        speak("Sorry, I could not understand you. Please repeat.")
        return ""

    except sr.RequestError:

        speak("Speech recognition service is unavailable. Please check your internet connection.")
        return ""

    except (OSError, AttributeError):

        speak("Please check your microphone and PyAudio installation.")
        return ""


# =====================================
# GREETING COMMAND
# =====================================

def greeting():

    speak("Hello! Nice to meet you. How can I help you today?")


# =====================================
# CURRENT TIME COMMAND
# =====================================

def tell_time():

    current_time = datetime.datetime.now().strftime("%I:%M %p")

    speak("The current time is " + current_time)


# =====================================
# CURRENT DATE COMMAND
# =====================================

def tell_date():

    current_date = datetime.datetime.now().strftime(
        "%A, %B %d, %Y"
    )

    speak("Today's date is " + current_date)


# =====================================
# GOOGLE SEARCH COMMAND
# =====================================

def search_web(command):

    search_words = [
        "search for",
        "search",
        "google",
        "look up"
    ]

    topic = command

    for word in search_words:

        if topic.startswith(word):

            topic = topic[len(word):].strip()
            break

    if not topic:

        speak("Please tell me what you want to search for.")
        return

    speak("Searching Google for " + topic)

    search_url = (
        "https://www.google.com/search?q="
        + quote_plus(topic)
    )

    webbrowser.open(search_url)


# =====================================
# WEATHER CITY EXTRACTION
# =====================================

def extract_weather_city(command):

    command = command.strip()

    patterns = [

        r"^(?:what(?:'s| is)\s+)?(?:the\s+)?weather"
        r"(?:\s+like)?(?:\s+in\s+(.+))?$",

        r"^tell me (?:the )?weather(?:\s+in\s+(.+))?$"

    ]

    for pattern in patterns:

        match = re.match(
            pattern,
            command,
            re.IGNORECASE
        )

        if match:

            city = match.group(1)

            if city:
                return city.strip(" .!?")

    return None


# =====================================
# LIVE WEATHER FUNCTION
# =====================================

def get_weather(city):

    if not WEATHER_API_KEY:

        speak("Weather API key is missing. Please configure your .env file.")

        return


    speak("Getting the latest weather information for " + city)


    try:

        # STEP 1: Find city coordinates
        # Use OpenWeatherMap Geocoding API

        geocoding_url = (
            "https://api.openweathermap.org/geo/1.0/direct"
        )

        geo_response = requests.get(

            geocoding_url,

            params={
                "q": city,
                "limit": 1,
                "appid": WEATHER_API_KEY
            },

            timeout=10

        )

        geo_response.raise_for_status()

        locations = geo_response.json()


        # Check whether city exists

        if not locations:

            speak(
                "Sorry, I could not find that city. "
                "Please try another city name."
            )

            return


        location = locations[0]

        latitude = location["lat"]

        longitude = location["lon"]

        city_name = location["name"]

        country = location.get("country", "")


        # STEP 2: Fetch current weather

        weather_url = (
            "https://api.openweathermap.org/data/2.5/weather"
        )

        weather_response = requests.get(

            weather_url,

            params={
                "lat": latitude,
                "lon": longitude,
                "appid": WEATHER_API_KEY,
                "units": "metric"
            },

            timeout=10

        )

        weather_response.raise_for_status()

        weather_data = weather_response.json()


        # STEP 3: Extract weather information

        temperature = weather_data["main"]["temp"]

        feels_like = weather_data["main"]["feels_like"]

        humidity = weather_data["main"]["humidity"]

        wind_speed = weather_data["wind"]["speed"]

        description = weather_data["weather"][0]["description"]


        # STEP 4: Display information

        print("\n========== WEATHER REPORT ==========")

        print("City:", city_name)

        print("Country:", country)

        print("Temperature:", temperature, "°C")

        print("Feels Like:", feels_like, "°C")

        print("Condition:", description)

        print("Humidity:", humidity, "%")

        print("Wind Speed:", wind_speed, "m/s")

        print("====================================\n")


        # STEP 5: Speak weather report

        speak(
            f"The current weather in {city_name} is "
            f"{description}. "
            f"The temperature is {temperature:.1f} degrees Celsius. "
            f"It feels like {feels_like:.1f} degrees. "
            f"Humidity is {humidity} percent. "
            f"Wind speed is {wind_speed:.1f} meters per second."
        )


    except requests.exceptions.Timeout:

        speak("The weather service is taking too long to respond. Please try again.")

    except requests.exceptions.HTTPError as error:

        status = error.response.status_code

        if status == 401:

            speak("Your weather API key is invalid or not activated yet.")

        elif status == 429:

            speak("The weather API request limit has been reached.")

        else:

            speak("The weather service returned an error.")

        print("Weather HTTP error:", error)


    except requests.exceptions.RequestException as error:

        print("Weather connection error:", error)

        speak("I could not connect to the weather service. Check your internet connection.")


    except (KeyError, ValueError, TypeError) as error:

        print("Weather data error:", error)

        speak("I could not read the weather information correctly.")


# =====================================
# WEATHER VOICE COMMAND
# =====================================

def weather_command(command):

    city = extract_weather_city(command)

    if not city:

        speak("Which city do you want the weather for?")

        city = listen()

        if not city:

            speak("I did not hear a city name. Please try again.")

            return

    get_weather(city)


# =====================================
# VOICE REMINDER COMMAND
# =====================================

def set_reminder(command):

    pattern = (
        r"^(?:please\s+)?(?:remind me|set (?:a )?reminder)"
        r"\s+in\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|"
        r"fifteen|twenty|thirty|forty|forty five|sixty|a|an)"
        r"\s+(seconds?|minutes?|hours?)"
        r"\s+to\s+(.+)$"
    )

    match = re.search(pattern, command, re.IGNORECASE)

    if not match:

        speak(
            "Please say, remind me in one minute to drink water."
        )

        return


    amount_text = match.group(1).lower()

    number_words = {

        "one": 1,
        "two": 2,
        "three": 3,
        "four": 4,
        "five": 5,
        "six": 6,
        "seven": 7,
        "eight": 8,
        "nine": 9,
        "ten": 10,
        "fifteen": 15,
        "twenty": 20,
        "thirty": 30,
        "forty": 40,
        "forty five": 45,
        "sixty": 60,
        "a": 1,
        "an": 1

    }

    if amount_text.isdigit():

        amount = int(amount_text)

    else:

        amount = number_words[amount_text]


    unit = match.group(2).lower()

    task = match.group(3).strip()


    if amount <= 0 or not task:

        speak("Please provide a valid reminder.")

        return

    if amount > 100000:

        speak("That reminder duration is too long.")

        return


    if unit.startswith("second"):

        seconds = amount

    elif unit.startswith("minute"):

        seconds = amount * 60

    else:

        seconds = amount * 3600


    reminder_time = (
        datetime.datetime.now()
        + timedelta(seconds=seconds)
    )


    reminders.append({

        "task": task,

        "time": reminder_time

    })


    speak(
        f"Reminder set. I will remind you to {task} "
        f"in {amount} {unit}."
    )


# =====================================
# CHECK REMINDERS
# =====================================

def check_reminders():

    current_time = datetime.datetime.now()

    for reminder in reminders.copy():

        if current_time >= reminder["time"]:

            speak(
                "Reminder! It is time to "
                + reminder["task"]
            )

            reminders.remove(reminder)


# =====================================
# PROCESS VOICE COMMANDS
# =====================================

def process_command(command):

    if not command:

        return True


    command = command.lower().strip().rstrip(".!?, ")

    words = set(command.split())


    # WEATHER COMMAND

    if "weather" in words:

        weather_command(command)


    # REMINDER COMMAND

    elif re.match(
        r"^(please\s+)?(remind me|set (a )?reminder)\b",
        command
    ):

        set_reminder(command)


    # GREETING

    elif words.intersection({"hello", "hi", "hey"}):

        greeting()


    # CURRENT TIME

    elif "time" in words:

        tell_time()


    # CURRENT DATE

    elif "date" in words or "today" in words:

        tell_date()


    # GOOGLE SEARCH

    elif command.startswith((

        "search for",
        "search",
        "google",
        "look up"

    )):

        search_web(command)


    # EXIT ASSISTANT

    elif words.intersection({

        "exit",
        "quit",
        "stop",
        "goodbye"

    }):

        speak("Goodbye! Have a wonderful day.")

        return False


    # UNKNOWN COMMAND

    else:

        speak(
            "Sorry, I do not know that command. Please try again."
        )


    return True


# =====================================
# MAIN PROGRAM
# =====================================

def main():

    speak("Hello! I am your Python voice assistant.")

    speak(
        "I can tell you the time and date, search Google, "
        "set reminders, and provide live weather updates."
    )


    # Adjust microphone background noise

    try:

        with sr.Microphone() as source:

            speak("Please wait while I adjust to background noise.")

            recognizer.adjust_for_ambient_noise(
                source,
                duration=1
            )

        speak("I am ready. You can speak now.")

    except (OSError, AttributeError) as error:

        print("Microphone error:", error)

        speak(
            "Microphone is not available. "
            "Please check your microphone and PyAudio installation."
        )

        return


    # CONTINUOUS LISTENING

    running = True

    while running:

        check_reminders()

        command = listen()

        if command:

            running = process_command(command)

        check_reminders()


# =====================================
# START APPLICATION
# =====================================

if __name__ == "__main__":

    main()

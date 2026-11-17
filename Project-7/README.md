# Python Voice Assistant

## Project Description

This project is a beginner-friendly Python voice assistant.
It listens to spoken commands and responds using speech.

## Technologies

- Python
- SpeechRecognition
- PyAudio
- pyttsx3
- datetime
- webbrowser

## Features

1. Voice recognition through microphone.
2. Responds to Hello.
3. Tells the current time.
4. Tells the current date.
5. Performs Google searches.
6. Speaks all assistant responses.
7. Handles microphone and recognition errors.

## Installation

Run:

pip install -r requirements.txt

## Execution

Run:

python main.py

## Privacy

The microphone is accessed when the assistant is listening.

SpeechRecognition's default Google recognition method sends
recorded audio to Google's online recognition service for
transcription.

No audio recordings are deliberately saved by this program.

Google search topics are sent to Google when a search command
is used.

The pyttsx3 speech output is generated locally.

## Future Improvements

- Weather updates
- Voice reminders
- Email sending
- General knowledge questions
- Custom voice commands
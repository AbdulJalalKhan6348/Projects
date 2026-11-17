// Getting HTML Elements
const form = document.getElementById("converterForm");

const temperatureInput = document.getElementById("temperature");
const unitSelect = document.getElementById("unit");

const message = document.getElementById("message");
const resultNote = document.getElementById("resultNote");

const resultCelsius = document.getElementById("resultCelsius");
const resultFahrenheit = document.getElementById("resultFahrenheit");
const resultKelvin = document.getElementById("resultKelvin");


// Absolute Zero Limits
const absoluteZero = {
    celsius: -273.15,
    fahrenheit: -459.67,
    kelvin: 0
};


// Temperature Unit Symbols
const symbols = {
    celsius: "°C",
    fahrenheit: "°F",
    kelvin: "K"
};


// Display Error Message
function showError(errorText) {

    message.textContent = errorText;
    message.className = "message error";

    resultCelsius.textContent = "--";
    resultFahrenheit.textContent = "--";
    resultKelvin.textContent = "--";

    resultNote.textContent = "Please correct your input.";
}


// Format Numbers
function formatTemperature(value) {

    // Avoid displaying negative zero
    if (Math.abs(value) < 0.0000000001) {
        value = 0;
    }

    return Number(value.toFixed(2)).toLocaleString("en-US", {
        maximumFractionDigits: 2
    });
}


// Main Conversion Function
form.addEventListener("submit", function(event) {

    event.preventDefault();

    // Get Input Value
    const inputValue = temperatureInput.value.trim();

    // Check Empty Input
    if (inputValue === "") {

        showError("Please enter a temperature value.");
        temperatureInput.focus();
        return;
    }

    // Convert Input into Number
    const temperature = Number(inputValue);

    // Check Numeric Input
    if (!Number.isFinite(temperature)) {

        showError("Invalid input! Please enter a valid number.");
        temperatureInput.focus();
        return;
    }

    // Get Selected Unit
    const selectedUnit = unitSelect.value;

    // Check Absolute Zero
    if (temperature < absoluteZero[selectedUnit]) {

        showError(
            `Temperature cannot be below absolute zero (${absoluteZero[selectedUnit]} ${symbols[selectedUnit]}).`
        );

        temperatureInput.focus();
        return;
    }


    // Convert Everything into Celsius First
    let celsius;

    if (selectedUnit === "celsius") {

        celsius = temperature;

    } else if (selectedUnit === "fahrenheit") {

        celsius = (temperature - 32) * 5 / 9;

    } else if (selectedUnit === "kelvin") {

        celsius = temperature - 273.15;

    }


    // Convert Celsius into Fahrenheit
    const fahrenheit = (celsius * 9 / 5) + 32;


    // Convert Celsius into Kelvin
    let kelvin = celsius + 273.15;

    // Remove tiny floating-point errors at absolute zero
    if (Math.abs(kelvin) < 0.0000000001) {
        kelvin = 0;
    }


    // Display All Results
    resultCelsius.textContent = formatTemperature(celsius);

    resultFahrenheit.textContent = formatTemperature(fahrenheit);

    resultKelvin.textContent = formatTemperature(kelvin);


    // Update Result Information
    resultNote.textContent =
        `Converted from ${formatTemperature(temperature)} ${symbols[selectedUnit]}`;


    // Clear Previous Error
    message.textContent = "";
    message.className = "message";

});

import math

print("===== BMI CALCULATOR =====")

try:
    weight = float(input("Enter your weight in kg: "))
    height = float(input("Enter your height in meters: "))

    if not math.isfinite(weight) or not math.isfinite(height):
        print("Error: Please enter valid numbers.")

    elif weight <= 0:
        print("Error: Weight must be greater than zero.")

    elif height <= 0:
        print("Error: Height must be greater than zero.")

    else:
        bmi = weight / (height ** 2)

        print(f"\nYour BMI is: {bmi:.2f}")

        if bmi < 18.5:
            category = "Underweight"
        elif bmi < 25:
            category = "Normal"
        elif bmi < 30:
            category = "Overweight"
        else:
            category = "Obese"

        print(f"Your category is: {category}")

except ValueError:
    print("Error: Please enter numeric values only.")

print("==========================")

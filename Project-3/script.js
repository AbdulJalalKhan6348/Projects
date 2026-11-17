// Getting HTML Elements
const expressionDisplay = document.getElementById("expression");
const resultDisplay = document.getElementById("result");
const statusDisplay = document.getElementById("status");

const buttons = document.querySelectorAll(".key");

// Calculator Variables
let expression = "";
let justEvaluated = false;


// Format the Result
function formatNumber(number) {

    if (Math.abs(number) < 0.0000000001) {
        number = 0;
    }

    return Number(number.toPrecision(12)).toString();
}


// Tokenize the Expression
function tokenize(input) {

    // Convert display operators into JavaScript-style operators
    input = input.replaceAll("×", "*").replaceAll("÷", "/");

    const tokens = [];
    let index = 0;
    let expectingNumber = true;

    while (index < input.length) {

        const char = input[index];

        // Ignore Spaces
        if (char === " ") {
            index++;
            continue;
        }

        // Read Numbers
        if (expectingNumber) {

            let sign = 1;

            // Handle Negative Numbers
            if (char === "-") {
                sign = -1;
                index++;

            } else if (char === "+") {
                index++;
            }

            // Read Decimal or Whole Number
            const remaining = input.slice(index);

            const match = remaining.match(
                /^(?:\d+\.?\d*|\.\d+)/
            );

            if (!match) {
                throw new Error("Incomplete expression.");
            }

            const value = sign * parseFloat(match[0]);

            if (!Number.isFinite(value)) {
                throw new Error("Invalid number.");
            }

            tokens.push(value);

            index += match[0].length;
            expectingNumber = false;

        } else {

            // Read Operators
            if (["+", "-", "*", "/"].includes(char)) {

                tokens.push(char);
                index++;
                expectingNumber = true;

            } else {

                throw new Error("Invalid expression.");
            }
        }
    }

    if (expectingNumber || tokens.length === 0) {
        throw new Error("Incomplete expression.");
    }

    return tokens;
}


// Calculate Expression Without eval()
function calculate(input) {

    const tokens = tokenize(input);

    const output = [];
    const operators = [];

    const precedence = {
        "+": 1,
        "-": 1,
        "*": 2,
        "/": 2
    };

    // Convert Infix Expression into Postfix
    tokens.forEach(function(token) {

        if (typeof token === "number") {

            output.push(token);

        } else {

            while (
                operators.length > 0 &&
                precedence[operators[operators.length - 1]] >= precedence[token]
            ) {

                output.push(operators.pop());
            }

            operators.push(token);
        }
    });

    // Add Remaining Operators
    while (operators.length > 0) {
        output.push(operators.pop());
    }


    // Evaluate Postfix Expression
    const stack = [];

    output.forEach(function(token) {

        if (typeof token === "number") {

            stack.push(token);

        } else {

            const secondNumber = stack.pop();
            const firstNumber = stack.pop();

            let answer;

            switch (token) {

                case "+":
                    answer = firstNumber + secondNumber;
                    break;

                case "-":
                    answer = firstNumber - secondNumber;
                    break;

                case "*":
                    answer = firstNumber * secondNumber;
                    break;

                case "/":

                    if (secondNumber === 0) {
                        throw new Error("Cannot divide by zero!");
                    }

                    answer = firstNumber / secondNumber;
                    break;
            }

            if (!Number.isFinite(answer)) {
                throw new Error("Result is too large.");
            }

            stack.push(answer);
        }
    });

    if (stack.length !== 1) {
        throw new Error("Invalid calculation.");
    }

    return stack[0];
}


// Update Display
function updateDisplay() {

    expressionDisplay.textContent = expression || "0";

    if (expression === "") {

        resultDisplay.textContent = "0";
        statusDisplay.textContent = "Ready";

        return;
    }

    try {

        const answer = calculate(expression);

        resultDisplay.textContent = formatNumber(answer);
        statusDisplay.textContent = "Live result";

    } catch (error) {

        if (error.message === "Cannot divide by zero!") {

            resultDisplay.textContent = "Error";
            statusDisplay.textContent = error.message;

        } else {

            resultDisplay.textContent = "—";
            statusDisplay.textContent = "Continue entering your calculation.";
        }
    }
}


// Add Number
function addNumber(number) {

    if (justEvaluated) {
        expression = "";
        justEvaluated = false;
    }

    expression += number;

    updateDisplay();
}


// Add Decimal Point
function addDecimal() {

    if (justEvaluated) {
        expression = "";
        justEvaluated = false;
    }

    if (expression === "") {
        expression = "0.";
        updateDisplay();
        return;
    }

    // Check the Last Character
    const lastCharacter = expression.slice(-1);

    if (["+","-","×","÷"].includes(lastCharacter)) {

        expression += "0.";

    } else {

        // Find the Current Number
        const operators = ["+", "-", "×", "÷"];

        let lastOperatorIndex = -1;

        operators.forEach(function(operator) {
            lastOperatorIndex = Math.max(
                lastOperatorIndex,
                expression.lastIndexOf(operator)
            );
        });

        const currentNumber = expression.slice(lastOperatorIndex + 1);

        if (!currentNumber.includes(".")) {
            expression += ".";
        }
    }

    updateDisplay();
}


// Add Operator
function addOperator(operator) {

    if (justEvaluated) {
        justEvaluated = false;
    }

    if (expression === "") {

        if (operator === "-") {
            expression = "-";
        }

        updateDisplay();
        return;
    }

    const lastCharacter = expression.slice(-1);

    const operators = ["+", "-", "×", "÷"];

    if (operators.includes(lastCharacter)) {

        const previousCharacter = expression.slice(-2, -1);

        // Allow a negative number after a binary operator
        if (operator === "-" && lastCharacter !== "-") {

            expression += "-";

        } else if (
            lastCharacter === "-" &&
            operators.includes(previousCharacter) &&
            expression.length > 1
        ) {

            // Replace an unfinished negative operand
            if (operator !== "-") {
                expression = expression.slice(0, -2) + operator;
            }

        } else if (lastCharacter !== "-") {

            // Replace the Previous Operator
            expression = expression.slice(0, -1) + operator;
        }

    } else {

        expression += operator;
    }

    updateDisplay();
}


// Clear Calculator
function clearCalculator() {

    expression = "";
    justEvaluated = false;

    updateDisplay();
}


// Delete Last Character
function deleteLastCharacter() {

    if (justEvaluated) {
        justEvaluated = false;
    }

    expression = expression.slice(0, -1);

    updateDisplay();
}


// Calculate Final Answer
function showResult() {

    if (expression === "") {
        statusDisplay.textContent = "Enter a calculation first.";
        return;
    }

    try {

        const answer = calculate(expression);

        expression = formatNumber(answer);

        justEvaluated = true;

        updateDisplay();

        statusDisplay.textContent = "Calculation complete";

    } catch (error) {

        resultDisplay.textContent = "Error";
        statusDisplay.textContent = error.message;
    }
}


// Add Event Listeners to All Buttons
buttons.forEach(function(button) {

    button.addEventListener("click", function() {

        const value = button.dataset.value;
        const action = button.dataset.action;

        if (value !== undefined) {

            if (!isNaN(value) && value !== "") {

                addNumber(value);

            } else if (value === ".") {

                addDecimal();

            } else {

                addOperator(value);
            }
        }

        // Button Actions
        switch (action) {

            case "clear":
                clearCalculator();
                break;

            case "delete":
                deleteLastCharacter();
                break;

            case "equals":
                showResult();
                break;
        }

    });

});


// Initial Display
updateDisplay();
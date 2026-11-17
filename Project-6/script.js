"use strict";


// =================================
// STORAGE SETTINGS
// =================================

const USERS_KEY = "auth_demo_users";
const SESSION_KEY = "auth_demo_session";

// PBKDF2 password hashing configuration
const PBKDF2_ITERATIONS = 600000;


// =================================
// HELPER FUNCTIONS
// =================================

// Display messages
function showMessage(element, text, type) {

    if (!element) return;

    element.textContent = text;

    element.className = "message " + type;
}


// Check whether browser supports secure password hashing
function cryptoIsAvailable() {

    return (
        window.isSecureContext &&
        window.crypto &&
        window.crypto.subtle
    );
}


// Read users from localStorage
function getUsers() {

    try {

        const savedUsers = localStorage.getItem(USERS_KEY);

        if (!savedUsers) {
            return [];
        }

        const users = JSON.parse(savedUsers);

        return Array.isArray(users) ? users : null;

    } catch (error) {

        console.error("Unable to read users:", error);

        return null;
    }
}


// Save registered users
function saveUsers(users) {

    try {

        localStorage.setItem(
            USERS_KEY,
            JSON.stringify(users)
        );

        return true;

    } catch (error) {

        console.error("Unable to save users:", error);

        return false;
    }
}


// Convert bytes into Base64
function bytesToBase64(bytes) {

    let binary = "";

    bytes.forEach(function(byte) {
        binary += String.fromCharCode(byte);
    });

    return btoa(binary);
}


// Convert Base64 into bytes
function base64ToBytes(base64) {

    const binary = atob(base64);

    return Uint8Array.from(
        binary,
        character => character.charCodeAt(0)
    );
}


// Generate a unique account ID
function generateId() {

    const randomBytes = new Uint8Array(16);

    crypto.getRandomValues(randomBytes);

    return bytesToBase64(randomBytes);
}


// =================================
// PASSWORD HASHING
// =================================

// Create a salted PBKDF2-SHA256 password hash
async function hashPassword(password, salt, iterations) {

    const encoder = new TextEncoder();

    const passwordKey = await crypto.subtle.importKey(

        "raw",

        encoder.encode(password),

        "PBKDF2",

        false,

        ["deriveBits"]
    );


    const hashBuffer = await crypto.subtle.deriveBits(

        {
            name: "PBKDF2",
            salt: salt,
            iterations: iterations,
            hash: "SHA-256"
        },

        passwordKey,

        256
    );


    return bytesToBase64(
        new Uint8Array(hashBuffer)
    );
}


// Check entered password against stored hash
async function verifyPassword(password, user) {

    try {

        const iterations = Number(user.iterations);

        if (
            !Number.isSafeInteger(iterations) ||
            iterations < 100000 ||
            iterations > 1000000
        ) {
            return false;
        }

        const salt = base64ToBytes(user.salt);

        if (salt.length !== 16) {
            return false;
        }

        const enteredHash = await hashPassword(
            password,
            salt,
            iterations
        );


        return enteredHash === user.passwordHash;

    } catch (error) {

        console.error("Password verification failed:", error);

        return false;
    }
}


// =================================
// REGISTRATION SYSTEM
// =================================

const registerForm = document.getElementById("registerForm");


if (registerForm) {

    const registerMessage =
        document.getElementById("registerMessage");

    registerForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        registerMessage.textContent = "";

        const username = document
            .getElementById("username")
            .value.trim();

        const email = document
            .getElementById("email")
            .value.trim()
            .toLowerCase();

        const password = document
            .getElementById("password")
            .value;

        const confirmPassword = document
            .getElementById("confirmPassword")
            .value;


        // Check browser security support
        if (!cryptoIsAvailable()) {

            showMessage(
                registerMessage,
                "Password hashing is unavailable. Please open this project using Live Server.",
                "error"
            );

            return;
        }


        // Check empty fields
        if (
            !username ||
            !email ||
            !password ||
            !confirmPassword
        ) {

            showMessage(
                registerMessage,
                "Please complete all fields.",
                "error"
            );

            return;
        }


        // Check username length
        if (username.length < 3 || username.length > 30) {

            showMessage(
                registerMessage,
                "Username must contain 3 to 30 characters.",
                "error"
            );

            return;
        }


        // Check password length
        if (password.length < 8) {

            showMessage(
                registerMessage,
                "Password must contain at least 8 characters.",
                "error"
            );

            return;
        }


        // Check password number requirement
        if (!/\d/.test(password)) {

            showMessage(
                registerMessage,
                "Password must contain at least one number.",
                "error"
            );

            return;
        }


        // Confirm password
        if (password !== confirmPassword) {

            showMessage(
                registerMessage,
                "Passwords do not match.",
                "error"
            );

            return;
        }


        // Read registered users
        const users = getUsers();

        if (users === null) {

            showMessage(
                registerMessage,
                "Unable to read account data. Please check browser storage.",
                "error"
            );

            return;
        }


        // Check duplicate username or email
        const duplicateUser = users.some(function(user) {

            return (
                user.username.toLowerCase() === username.toLowerCase() ||
                user.email.toLowerCase() === email
            );

        });


        if (duplicateUser) {

            showMessage(
                registerMessage,
                "This username or email is already registered.",
                "error"
            );

            return;
        }


        // Disable button during password hashing
        const registerButton =
            registerForm.querySelector("button[type='submit']");

        registerButton.disabled = true;

        registerButton.textContent = "Creating Account...";


        try {

            // Generate a unique random salt
            const salt = crypto.getRandomValues(
                new Uint8Array(16)
            );


            // Hash the password
            const passwordHash = await hashPassword(
                password,
                salt,
                PBKDF2_ITERATIONS
            );


            // Create new user
            const newUser = {

                id: generateId(),

                username: username,

                email: email,

                salt: bytesToBase64(salt),

                passwordHash: passwordHash,

                iterations: PBKDF2_ITERATIONS,

                createdAt: new Date().toISOString()

            };


            // Add new user
            users.push(newUser);


            // Save user information
            if (!saveUsers(users)) {

                showMessage(
                    registerMessage,
                    "Account could not be saved. Browser storage may be unavailable or full.",
                    "error"
                );

                return;
            }


            // Redirect to login page
            window.location.href = "login.html?registered=1";

        } catch (error) {

            console.error("Registration error:", error);

            showMessage(
                registerMessage,
                "Something went wrong. Please try again.",
                "error"
            );

        } finally {

            registerButton.disabled = false;

            registerButton.textContent = "Register";
        }

    });

}


// =================================
// LOGIN SYSTEM
// =================================

const loginForm = document.getElementById("loginForm");


if (loginForm) {

    const loginMessage =
        document.getElementById("loginMessage");


    // Registration success message
    const urlParams = new URLSearchParams(
        window.location.search
    );

    if (urlParams.get("registered") === "1") {

        showMessage(
            loginMessage,
            "Account created successfully! You can now log in.",
            "success"
        );

    }


    loginForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        loginMessage.textContent = "";


        const identifier = document
            .getElementById("loginIdentifier")
            .value.trim()
            .toLowerCase();

        const password = document
            .getElementById("loginPassword")
            .value;


        // Check empty fields
        if (!identifier || !password) {

            showMessage(
                loginMessage,
                "Please enter your username/email and password.",
                "error"
            );

            return;
        }


        // Check hashing support
        if (!cryptoIsAvailable()) {

            showMessage(
                loginMessage,
                "Password verification is unavailable. Please use Live Server.",
                "error"
            );

            return;
        }


        // Read registered users
        const users = getUsers();

        if (users === null) {

            showMessage(
                loginMessage,
                "Unable to access account information.",
                "error"
            );

            return;
        }


        // Find account by username OR email
        const user = users.find(function(item) {

            return (
                item.username.toLowerCase() === identifier ||
                item.email.toLowerCase() === identifier
            );

        });


        // Disable login button
        const loginButton =
            loginForm.querySelector("button[type='submit']");

        loginButton.disabled = true;

        loginButton.textContent = "Checking...";


        try {

            // Verify password
            const validLogin = user
                ? await verifyPassword(password, user)
                : false;


            // Generic error message
            if (!validLogin) {

                showMessage(
                    loginMessage,
                    "Invalid username/email or password.",
                    "error"
                );

                return;
            }


            // Create login session
            const session = {

                userId: user.id,

                loginAt: new Date().toISOString()

            };


            // Store session in sessionStorage
            sessionStorage.setItem(
                SESSION_KEY,
                JSON.stringify(session)
            );


            // Open protected dashboard
            window.location.href = "dashboard.html";


        } catch (error) {

            console.error("Login error:", error);

            showMessage(
                loginMessage,
                "Login failed. Please try again.",
                "error"
            );

        } finally {

            loginButton.disabled = false;

            loginButton.textContent = "Login";
        }

    });

}


// =================================
// PROTECTED DASHBOARD
// =================================

const dashboardPage =
    document.body.dataset.page === "dashboard";


if (dashboardPage) {

    const logoutButton =
        document.getElementById("logoutBtn");


    function protectDashboard() {

        try {

            // Get current session
            const savedSession =
                sessionStorage.getItem(SESSION_KEY);

            if (!savedSession) {

                window.location.replace("login.html");

                return;
            }


            const session = JSON.parse(savedSession);


            // Get registered users
            const users = getUsers();

            if (!Array.isArray(users)) {

                sessionStorage.removeItem(SESSION_KEY);

                window.location.replace("login.html");

                return;
            }


            // Check whether session user exists
            const currentUser = users.find(function(user) {

                return user.id === session.userId;

            });


            if (!currentUser) {

                sessionStorage.removeItem(SESSION_KEY);

                window.location.replace("login.html");

                return;
            }


            // Display user information safely
            document.getElementById(
                "displayUsername"
            ).textContent = currentUser.username;


            document.getElementById(
                "userUsername"
            ).textContent = currentUser.username;


            document.getElementById(
                "userEmail"
            ).textContent = currentUser.email;


            document.getElementById(
                "userCreated"
            ).textContent = formatDate(currentUser.createdAt);

        } catch (error) {

            console.error("Dashboard error:", error);

            sessionStorage.removeItem(SESSION_KEY);

            window.location.replace("login.html");
        }

    }


    // Format Account Creation Date
    function formatDate(dateValue) {

        const date = new Date(dateValue);

        if (Number.isNaN(date.getTime())) {
            return "Not available";
        }

        return date.toLocaleDateString();
    }


    // Run Authentication Check
    protectDashboard();


    // =================================
    // LOGOUT SYSTEM
    // =================================

    logoutButton.addEventListener("click", function() {

        sessionStorage.removeItem(SESSION_KEY);

        window.location.replace("login.html");

    });

}
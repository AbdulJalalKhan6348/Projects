
import sqlite3
import hashlib
import secrets
import hmac

# Database configuration
DB_NAME = "chat_app.db"

# Password security settings
HASH_ITERATIONS = 310000


# Create database and users table
def initialize_database():

    try:
        with sqlite3.connect(DB_NAME) as connection:

            connection.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    salt TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

        print("Database initialized successfully!")

    except sqlite3.Error as error:
        print(f"Database error: {error}")


# Hash password securely
def hash_password(password, salt=None):

    if salt is None:
        salt = secrets.token_bytes(16)

    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        HASH_ITERATIONS
    )

    return salt.hex(), password_hash.hex()


# Register a new user
def register_user(username, password):

    username = username.strip()

    if not username:
        return False, "Username cannot be empty."

    if len(username) > 30:
        return False, "Username must be 30 characters or fewer."

    if not password:
        return False, "Password cannot be empty."

    if len(password) < 8:
        return False, "Password must contain at least 8 characters."

    salt, password_hash = hash_password(password)

    try:
        with sqlite3.connect(DB_NAME) as connection:

            connection.execute(
                """
                INSERT INTO users (username, salt, password_hash)
                VALUES (?, ?, ?)
                """,
                (username, salt, password_hash)
            )

        return True, "Account created successfully!"

    except sqlite3.IntegrityError:
        return False, "Username already exists."

    except sqlite3.Error as error:
        return False, f"Database error: {error}"


# Authenticate an existing user
def authenticate_user(username, password):

    username = username.strip()

    if not username or not password:
        return False, "Username and password are required."

    try:
        with sqlite3.connect(DB_NAME) as connection:

            cursor = connection.execute(
                """
                SELECT salt, password_hash
                FROM users
                WHERE username = ? COLLATE NOCASE
                """,
                (username,)
            )

            user = cursor.fetchone()

        if user is None:
            return False, "Username or password is incorrect."

        stored_salt, stored_hash = user

        salt = bytes.fromhex(stored_salt)

        _, entered_hash = hash_password(password, salt)

        if hmac.compare_digest(entered_hash, stored_hash):
            return True, "Login successful!"

        return False, "Username or password is incorrect."

    except (sqlite3.Error, ValueError) as error:
        return False, f"Database error: {error}"


# Test the database
if __name__ == "__main__":

    initialize_database()

    print("\n===== CHAT APP DATABASE =====")
    print("1. Register")
    print("2. Login")

    choice = input("Choose an option: ").strip()

    username = input("Enter username: ").strip()

    import getpass
    password = input("Enter password: ").strip()

    if choice == "1":

        success, message = register_user(username, password)

    elif choice == "2":

        success, message = authenticate_user(username, password)

    else:
        success, message = False, "Invalid option."

    print("\n" + message)

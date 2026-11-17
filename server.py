
import socket
import threading
from datetime import datetime

# Server configuration
HOST = "127.0.0.1"
PORT = 5000

# Store connected clients
clients = {}
clients_lock = threading.Lock()


# Get current time
def get_time():
    return datetime.now().strftime("%H:%M")


# Send a message to all connected clients

def broadcast(message):
    with clients_lock:
        connected_clients = list(clients.items())

    print(
        f"\nBroadcasting to {len(connected_clients)} client(s): {message}"
    )

    for client_socket, username in connected_clients:
        try:
            client_socket.sendall(
                (message + "\n").encode("utf-8")
            )

            print(f"Message sent to: {username}")

        except OSError:
            print(f"Failed to send message to: {username}")


# Handle each connected client
def handle_client(client_socket, address):
    username = ""

    try:
        # Ask client for username
        client_socket.sendall(b"Enter your username:\n")

        username = client_socket.recv(1024).decode("utf-8").strip()

        if not username:
            return

        # Register client
        with clients_lock:
            clients[client_socket] = username

        print(f"{username} connected from {address}")

        broadcast(
            f"[{get_time()}] {username} joined the chat."
        )

        # Receive messages continuously
        buffer = ""

        while True:
            data = client_socket.recv(1024)

            if not data:
                break

            buffer += data.decode("utf-8")

            # Process complete messages
            while "\n" in buffer:
                message, buffer = buffer.split("\n", 1)
                message = message.strip()

                if not message:
                    continue

                if message.lower() == "/quit":
                    return

                chat_message = (
                    f"[{get_time()}] {username}: {message}"
                )

                print(chat_message)
                broadcast(chat_message)

    except (ConnectionError, OSError):
        print(f"{username} connection lost.")

    finally:
        # Remove disconnected client
        with clients_lock:
            was_connected = client_socket in clients
            clients.pop(client_socket, None)

        client_socket.close()

        if was_connected:
            print(f"{username} disconnected.")

            broadcast(
                f"[{get_time()}] {username} left the chat."
            )


# Start the server
def start_server():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    server.bind((HOST, PORT))
    server.listen()

    print("===== CHAT SERVER =====")
    print(f"Server running on {HOST}:{PORT}")
    print("Waiting for clients...")
    print("=======================")

    try:
        while True:
            client_socket, address = server.accept()

            thread = threading.Thread(
                target=handle_client,
                args=(client_socket, address),
                daemon=True
            )

            thread.start()

    except KeyboardInterrupt:
        print("\nServer shutting down...")

    finally:
        server.close()


if __name__ == "__main__":
    start_server()

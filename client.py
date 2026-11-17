
import socket
import threading

HOST = "127.0.0.1"
PORT = 5000


def receive_messages(client_socket):
    buffer = ""

    try:
        while True:
            data = client_socket.recv(1024)

            if not data:
                print("\nServer disconnected.")
                break

            buffer += data.decode("utf-8")

            while "\n" in buffer:
                message, buffer = buffer.split("\n", 1)

                if message:
                    print("\n" + message)

    except OSError:
        pass


def start_client():
    client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    receive_thread = None

    try:
        client_socket.connect((HOST, PORT))

        print("Connected to chat server!")

        # Receive username prompt
        prompt = client_socket.recv(1024).decode("utf-8")
        print(prompt, end="")

        username = input().strip()

        while not username:
            print("Username cannot be empty. Enter again:")
            username = input().strip()

        # Send username
        client_socket.sendall(
            (username + "\n").encode("utf-8")
        )

        print(f"Welcome, {username}!")

        # Start receiving messages
        receive_thread = threading.Thread(
            target=receive_messages,
            args=(client_socket,)
        )

        receive_thread.start()

        print("\n===== CHAT STARTED =====")
        print("Type your message and press Enter.")
        print("Type /quit to leave the chat.")
        print("========================")

        while True:
            message = input("> ").strip()

            if not message:
                continue

            client_socket.sendall(
                (message + "\n").encode("utf-8")
            )

            if message.lower() == "/quit":
                print("Leaving chat...")
                break

    except ConnectionRefusedError:
        print("Error: Server is not running.")

    except KeyboardInterrupt:
        print("\nChat interrupted.")

    except (ConnectionError, OSError) as error:
        print(f"Connection error: {error}")

    finally:
        # Stop the receiving thread safely
        try:
            client_socket.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass

        client_socket.close()

        if receive_thread is not None:
            receive_thread.join(timeout=2)

        print("Client closed safely.")


if __name__ == "__main__":
    start_client()

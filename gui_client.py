
import socket
import threading
import tkinter as tk
from tkinter import messagebox, scrolledtext
import queue

from database import (
    initialize_database,
    register_user,
    authenticate_user
)

# Server configuration
HOST = "127.0.0.1"
PORT = 5000


class ChatGUI:

    def __init__(self, root):
        self.root = root
        self.root.title("Python Chat Application")
        self.root.geometry("550x550")

        self.client_socket = None
        self.connected = False
        self.message_queue = queue.Queue()

        initialize_database()

        self.show_login_screen()

        self.root.after(100, self.check_messages)
        self.root.protocol("WM_DELETE_WINDOW", self.close_window)

    # Display login and registration screen
    def show_login_screen(self):

        for widget in self.root.winfo_children():
            widget.destroy()

        frame = tk.Frame(self.root)
        frame.pack(expand=True)

        tk.Label(
            frame,
            text="Python Chat Application",
            font=("Arial", 20, "bold")
        ).pack(pady=20)

        tk.Label(frame, text="Username").pack()

        self.username_entry = tk.Entry(frame, width=30)
        self.username_entry.pack(pady=5)

        tk.Label(frame, text="Password").pack()

        self.password_entry = tk.Entry(
            frame,
            width=30,
            show="*"
        )
        self.password_entry.pack(pady=5)

        tk.Button(
            frame,
            text="Register",
            width=20,
            command=self.register
        ).pack(pady=8)

        tk.Button(
            frame,
            text="Login",
            width=20,
            command=self.login
        ).pack(pady=5)

        self.status_label = tk.Label(
            frame,
            text="Please register or login.",
            fg="blue"
        )
        self.status_label.pack(pady=10)

    # Register a new user
    def register(self):

        username = self.username_entry.get().strip()
        password = self.password_entry.get()

        success, message = register_user(username, password)

        if success:
            messagebox.showinfo("Registration", message)
            self.password_entry.delete(0, tk.END)
        else:
            messagebox.showerror("Registration", message)

    # Login existing user
    def login(self):

        username = self.username_entry.get().strip()
        password = self.password_entry.get()

        success, message = authenticate_user(
            username,
            password
        )

        if not success:
            messagebox.showerror("Login Failed", message)
            return

        self.connect_to_server(username)

    # Connect authenticated user to server
    def connect_to_server(self, username):

        client = socket.socket(
            socket.AF_INET,
            socket.SOCK_STREAM
        )

        try:
            client.settimeout(5)
            client.connect((HOST, PORT))

            prompt = client.recv(1024)

            if not prompt:
                raise ConnectionError("Server closed the connection.")

            client.sendall(
                (username + "\n").encode("utf-8")
            )

            client.settimeout(None)

            self.client_socket = client
            self.connected = True

            self.show_chat_screen(username)

            thread = threading.Thread(
                target=self.receive_messages,
                args=(client,),
                daemon=True
            )

            thread.start()

        except (OSError, ConnectionError) as error:

            client.close()

            messagebox.showerror(
                "Connection Error",
                f"Could not connect to server:\n{error}"
            )

    # Display chat screen
    def show_chat_screen(self, username):

        for widget in self.root.winfo_children():
            widget.destroy()

        tk.Label(
            self.root,
            text=f"Welcome, {username}!",
            font=("Arial", 18, "bold")
        ).pack(pady=10)

        self.status_label = tk.Label(
            self.root,
            text="Connected",
            fg="green"
        )
        self.status_label.pack()

        self.chat_area = scrolledtext.ScrolledText(
            self.root,
            width=60,
            height=20,
            state=tk.DISABLED,
            font=("Arial", 10)
        )
        self.chat_area.pack(padx=10, pady=10)

        message_frame = tk.Frame(self.root)
        message_frame.pack(pady=10)

        self.message_entry = tk.Entry(
            message_frame,
            width=40
        )
        self.message_entry.pack(side=tk.LEFT, padx=5)

        self.message_entry.bind(
            "<Return>",
            self.send_message
        )

        tk.Button(
            message_frame,
            text="Send",
            command=self.send_message
        ).pack(side=tk.LEFT)

        tk.Button(
            self.root,
            text="Logout",
            command=self.disconnect
        ).pack(pady=5)

    # Receive server messages
    def receive_messages(self, client):

        buffer = b""

        try:
            while self.connected:

                data = client.recv(4096)

                if not data:
                    self.message_queue.put(
                        ("disconnect", "Server disconnected.")
                    )
                    break

                buffer += data

                while b"\n" in buffer:

                    message, buffer = buffer.split(b"\n", 1)

                    decoded_message = message.decode(
                        "utf-8"
                    ).strip()

                    if decoded_message:
                        self.message_queue.put(
                            ("message", decoded_message)
                        )

        except OSError:

            if self.connected:
                self.message_queue.put(
                    ("disconnect", "Connection lost.")
                )

    # Display a chat message
    def display_message(self, message):

        self.chat_area.config(state=tk.NORMAL)

        self.chat_area.insert(
            tk.END,
            message + "\n"
        )

        self.chat_area.see(tk.END)

        self.chat_area.config(state=tk.DISABLED)

    # Process received messages safely
    def check_messages(self):

        while True:

            try:
                message_type, content = (
                    self.message_queue.get_nowait()
                )

            except queue.Empty:
                break

            if message_type == "message" and self.connected:
                self.display_message(content)

            elif message_type == "disconnect" and self.connected:

                self.display_message(content)
                self.disconnect(send_quit=False)

        self.root.after(100, self.check_messages)

    # Send messages
    def send_message(self, event=None):

        if not self.connected:
            return

        message = self.message_entry.get().strip()

        if not message:
            return

        try:
            self.client_socket.sendall(
                (message + "\n").encode("utf-8")
            )

            self.message_entry.delete(0, tk.END)

            if message.lower() == "/quit":
                self.disconnect()

        except OSError:

            messagebox.showerror(
                "Error",
                "Unable to send message."
            )

            self.disconnect(send_quit=False)

    # Disconnect from server
    def disconnect(self, send_quit=True):

        self.connected = False

        client = self.client_socket
        self.client_socket = None

        if client:

            try:
                if send_quit:
                    client.sendall(b"/quit\n")

                client.shutdown(socket.SHUT_RDWR)

            except OSError:
                pass

            client.close()

        while not self.message_queue.empty():
            try:
                self.message_queue.get_nowait()
            except queue.Empty:
                break

        self.show_login_screen()

    # Close application
    def close_window(self):

        self.disconnect(send_quit=True)
        self.root.destroy()


# Run application
if __name__ == "__main__":

    root = tk.Tk()

    app = ChatGUI(root)

    root.mainloop()


import tkinter as tk
from tkinter import ttk, messagebox
import string
import secrets
import pyperclip


class PasswordGeneratorApp:

    def __init__(self, root):
        self.root = root
        self.root.title("Random Password Generator")
        self.root.geometry("550x720")
        self.root.resizable(False, False)

        # Store last 5 passwords in session memory
        self.history = []

        # Variables
        self.length_var = tk.StringVar(value="16")
        self.upper_var = tk.BooleanVar(value=True)
        self.lower_var = tk.BooleanVar(value=True)
        self.number_var = tk.BooleanVar(value=True)
        self.symbol_var = tk.BooleanVar(value=True)
        self.exclude_var = tk.BooleanVar(value=False)

        self.password_var = tk.StringVar()
        self.status_var = tk.StringVar(
            value="Choose your settings and generate a password."
        )

        self.create_widgets()

    def create_widgets(self):

        main_frame = ttk.Frame(self.root, padding=20)
        main_frame.pack(fill="both", expand=True)

        # Application heading
        ttk.Label(
            main_frame,
            text="RANDOM PASSWORD GENERATOR",
            font=("Arial", 17, "bold")
        ).pack(pady=10)

        ttk.Label(
            main_frame,
            text="Create strong and secure passwords"
        ).pack(pady=5)

        # Password length section
        length_frame = ttk.LabelFrame(
            main_frame,
            text="Password Length",
            padding=10
        )
        length_frame.pack(fill="x", pady=10)

        ttk.Label(
            length_frame,
            text="Select password length (8-128):"
        ).pack(side="left")

        ttk.Spinbox(
            length_frame,
            from_=8,
            to=128,
            textvariable=self.length_var,
            width=8
        ).pack(side="right")

        # Character type section
        type_frame = ttk.LabelFrame(
            main_frame,
            text="Select Character Types",
            padding=10
        )
        type_frame.pack(fill="x", pady=10)

        ttk.Checkbutton(
            type_frame,
            text="Uppercase Letters (ABC)",
            variable=self.upper_var
        ).pack(anchor="w", pady=3)

        ttk.Checkbutton(
            type_frame,
            text="Lowercase Letters (abc)",
            variable=self.lower_var
        ).pack(anchor="w", pady=3)

        ttk.Checkbutton(
            type_frame,
            text="Numbers (123)",
            variable=self.number_var
        ).pack(anchor="w", pady=3)

        ttk.Checkbutton(
            type_frame,
            text="Symbols (@#$%)",
            variable=self.symbol_var
        ).pack(anchor="w", pady=3)

        # Exclude ambiguous characters
        ttk.Checkbutton(
            main_frame,
            text="Exclude ambiguous characters (0, O, l, 1)",
            variable=self.exclude_var
        ).pack(anchor="w", pady=8)

        # Generate password button
        ttk.Button(
            main_frame,
            text="GENERATE PASSWORD",
            command=self.generate_password
        ).pack(fill="x", pady=12)

        # Password display section
        password_frame = ttk.LabelFrame(
            main_frame,
            text="Your Generated Password",
            padding=10
        )
        password_frame.pack(fill="x", pady=8)

        self.password_entry = ttk.Entry(
            password_frame,
            textvariable=self.password_var,
            font=("Consolas", 12),
            state="readonly"
        )
        self.password_entry.pack(fill="x", pady=5)

        ttk.Button(
            password_frame,
            text="COPY TO CLIPBOARD",
            command=self.copy_password
        ).pack(fill="x", pady=5)

        # Password strength section
        strength_frame = ttk.LabelFrame(
            main_frame,
            text="Password Strength",
            padding=10
        )
        strength_frame.pack(fill="x", pady=8)

        self.strength_label = ttk.Label(
            strength_frame,
            text="Strength: Not generated",
            font=("Arial", 10, "bold")
        )
        self.strength_label.pack(pady=4)

        self.strength_bar = ttk.Progressbar(
            strength_frame,
            maximum=3,
            length=300,
            mode="determinate"
        )
        self.strength_bar.pack(fill="x", pady=5)

        # Generation history
        history_frame = ttk.LabelFrame(
            main_frame,
            text="Last 5 Generated Passwords (Session Only)",
            padding=10
        )
        history_frame.pack(fill="both", pady=8)

        self.history_list = tk.Listbox(
            history_frame,
            height=5,
            font=("Consolas", 10)
        )
        self.history_list.pack(fill="x")

        # Status message
        ttk.Label(
            main_frame,
            textvariable=self.status_var,
            wraplength=480,
            foreground="blue"
        ).pack(pady=8)

    # Generate secure password
    def generate_password(self):

        # Validate password length
        try:
            length = int(self.length_var.get())
        except ValueError:
            messagebox.showerror(
                "Invalid Length",
                "Please enter a valid number."
            )
            return

        if length < 8 or length > 128:
            messagebox.showerror(
                "Invalid Length",
                "Password length must be between 8 and 128."
            )
            return

        # Define character groups
        character_groups = {
            "Uppercase": string.ascii_uppercase,
            "Lowercase": string.ascii_lowercase,
            "Numbers": string.digits,
            "Symbols": string.punctuation
        }

        # Get selected types
        selected_groups = []

        if self.upper_var.get():
            selected_groups.append(character_groups["Uppercase"])

        if self.lower_var.get():
            selected_groups.append(character_groups["Lowercase"])

        if self.number_var.get():
            selected_groups.append(character_groups["Numbers"])

        if self.symbol_var.get():
            selected_groups.append(character_groups["Symbols"])

        # Validate character selection
        if len(selected_groups) < 2:
            messagebox.showerror(
                "Selection Error",
                "Please select at least two character types."
            )
            return

        # Exclude ambiguous characters if selected
        if self.exclude_var.get():

            ambiguous = set("0Ol1")

            selected_groups = [
                "".join(
                    char for char in group
                    if char not in ambiguous
                )
                for group in selected_groups
            ]

        # Combine selected characters
        all_characters = "".join(selected_groups)

        # Guarantee one character from each selected group
        password_characters = [
            secrets.choice(group)
            for group in selected_groups
        ]

        # Fill remaining password length
        for _ in range(length - len(password_characters)):
            password_characters.append(
                secrets.choice(all_characters)
            )

        # Securely shuffle password characters
        for index in range(len(password_characters) - 1, 0, -1):
            swap_index = secrets.randbelow(index + 1)

            password_characters[index], password_characters[swap_index] = (
                password_characters[swap_index],
                password_characters[index]
            )

        # Create final password
        password = "".join(password_characters)

        # Display password
        self.password_var.set(password)

        # Update password strength
        self.update_strength(length, len(selected_groups))

        # Automatically copy password
        try:
            pyperclip.copy(password)
            self.status_var.set(
                "Password generated and copied to clipboard!"
            )
        except Exception:
            self.status_var.set(
                "Password generated. Clipboard copy failed; "
                "please use the Copy button."
            )

        # Save last 5 passwords in memory
        self.history.insert(0, password)
        self.history = self.history[:5]

        # Update history display
        self.history_list.delete(0, tk.END)

        for item in self.history:
            self.history_list.insert(tk.END, item)

    # Password strength indicator
    def update_strength(self, length, diversity):

        if length >= 16 and diversity >= 3:
            strength = "Strong"
            level = 3

        elif length >= 12 and diversity >= 2:
            strength = "Medium"
            level = 2

        else:
            strength = "Weak"
            level = 1

        self.strength_label.config(
            text=f"Strength: {strength}"
        )

        self.strength_bar["value"] = level

    # Copy password manually
    def copy_password(self):

        password = self.password_var.get()

        if not password:
            messagebox.showwarning(
                "No Password",
                "Please generate a password first."
            )
            return

        try:
            pyperclip.copy(password)
            self.status_var.set(
                "Password copied successfully!"
            )
        except Exception:
            messagebox.showerror(
                "Clipboard Error",
                "Could not copy password to clipboard."
            )


# Main GUI window
if __name__ == "__main__":

    root = tk.Tk()

    app = PasswordGeneratorApp(root)

    root.mainloop()

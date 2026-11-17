import tkinter as tk
from tkinter import ttk, messagebox
import sqlite3
import math
from datetime import datetime
from pathlib import Path

from matplotlib.figure import Figure
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg


# Keep the database in the same folder as this Python file.
DB_NAME = Path(__file__).with_name("bmi_records.db")


# --------------------------------------------------
# DATABASE
# --------------------------------------------------
def initialize_database():
    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS bmi_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_name TEXT NOT NULL,
                weight REAL NOT NULL,
                height REAL NOT NULL,
                bmi REAL NOT NULL,
                category TEXT NOT NULL,
                recorded_at TEXT NOT NULL
            )
            """
        )
        conn.commit()
        return True

    except sqlite3.Error as error:
        messagebox.showerror(
            "Database Error",
            f"Could not initialize the database:\n{error}"
        )
        return False

    finally:
        if conn is not None:
            conn.close()


# --------------------------------------------------
# BMI CALCULATION AND INPUT VALIDATION
# --------------------------------------------------
def calculate_values(weight, height):
    bmi = weight / (height ** 2)

    if not math.isfinite(bmi):
        raise ValueError("The BMI result is outside the supported numeric range.")

    if bmi < 18.5:
        category, color = "Underweight", "blue"
    elif bmi < 25:
        category, color = "Normal", "green"
    elif bmi < 30:
        category, color = "Overweight", "orange"
    else:
        category, color = "Obese", "red"

    return bmi, category, color


def get_user_data():
    name = name_entry.get().strip()

    if not name:
        messagebox.showwarning(
            "Missing Name",
            "Please enter the user's name."
        )
        return None

    try:
        weight = float(weight_entry.get())
        height = float(height_entry.get())

        if not math.isfinite(weight) or not math.isfinite(height):
            raise ValueError

        if weight <= 0:
            messagebox.showwarning(
                "Invalid Weight",
                "Weight must be greater than zero."
            )
            return None

        if height <= 0:
            messagebox.showwarning(
                "Invalid Height",
                "Height must be greater than zero."
            )
            return None

        return name, weight, height

    except ValueError:
        messagebox.showerror(
            "Invalid Input",
            "Please enter a name and valid positive numeric values for weight and height."
        )
        return None


def calculate_bmi():
    data = get_user_data()
    if data is None:
        return None

    name, weight, height = data

    try:
        bmi, category, color = calculate_values(weight, height)
    except (ValueError, ZeroDivisionError, OverflowError):
        messagebox.showerror(
            "Calculation Error",
            "These values are too large or too small to calculate a valid BMI."
        )
        return None

    result_label.config(
        text=f"Hello, {name}!\n\nBMI: {bmi:.2f}\nCategory: {category}",
        fg=color
    )

    return name, weight, height, bmi, category


# --------------------------------------------------
# SAVE BMI RECORD
# --------------------------------------------------
def save_record():
    if not DB_READY:
        messagebox.showerror(
            "Database Error",
            "The database is not available."
        )
        return

    data = calculate_bmi()
    if data is None:
        return

    name, weight, height, bmi, category = data
    recorded_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        conn.execute(
            """
            INSERT INTO bmi_records
                (user_name, weight, height, bmi, category, recorded_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (name, weight, height, bmi, category, recorded_at)
        )
        conn.commit()

        messagebox.showinfo(
            "Record Saved",
            f"BMI record saved successfully for {name}."
        )

    except sqlite3.Error as error:
        messagebox.showerror(
            "Database Error",
            f"Could not save the record:\n{error}"
        )

    finally:
        if conn is not None:
            conn.close()


# --------------------------------------------------
# SHOW BMI HISTORY TABLE
# --------------------------------------------------
def show_history():
    user_name = name_entry.get().strip()
    conn = None

    try:
        conn = sqlite3.connect(DB_NAME)

        if user_name:
            records = conn.execute(
                """
                SELECT recorded_at, user_name, weight, height, bmi, category
                FROM bmi_records
                WHERE LOWER(user_name) = LOWER(?)
                ORDER BY recorded_at DESC, id DESC
                LIMIT 100
                """,
                (user_name,)
            ).fetchall()
        else:
            records = conn.execute(
                """
                SELECT recorded_at, user_name, weight, height, bmi, category
                FROM bmi_records
                ORDER BY recorded_at DESC, id DESC
                LIMIT 100
                """
            ).fetchall()

    except sqlite3.Error as error:
        messagebox.showerror(
            "Database Error",
            f"Could not read BMI history:\n{error}"
        )
        return

    finally:
        if conn is not None:
            conn.close()

    history_window = tk.Toplevel(root)
    history_window.title("BMI History")
    history_window.geometry("850x400")
    history_window.configure(bg="#f0f4f8")

    heading = (
        f"BMI History for {user_name}"
        if user_name else "BMI History - All Users"
    )

    tk.Label(
        history_window,
        text=heading,
        font=("Arial", 17, "bold"),
        bg="#f0f4f8",
        fg="#1e3a5f"
    ).pack(pady=15)

    if not records:
        tk.Label(
            history_window,
            text="No saved records found.",
            font=("Arial", 12),
            bg="#f0f4f8"
        ).pack(pady=20)
        return

    columns = ("date", "name", "weight", "height", "bmi", "category")
    table = ttk.Treeview(
        history_window,
        columns=columns,
        show="headings"
    )

    headings = {
        "date": "Date",
        "name": "User",
        "weight": "Weight (kg)",
        "height": "Height (m)",
        "bmi": "BMI",
        "category": "Category"
    }
    widths = {
        "date": 160,
        "name": 120,
        "weight": 100,
        "height": 100,
        "bmi": 90,
        "category": 120
    }

    for column in columns:
        table.heading(column, text=headings[column])
        table.column(column, width=widths[column], anchor="center")

    for date, name, weight, height, bmi, category in records:
        table.insert(
            "",
            tk.END,
            values=(
                date,
                name,
                f"{weight:.1f}",
                f"{height:.2f}",
                f"{bmi:.2f}",
                category
            )
        )

    scrollbar = ttk.Scrollbar(
        history_window,
        orient="vertical",
        command=table.yview
    )
    table.configure(yscrollcommand=scrollbar.set)

    table.pack(
        side="left",
        fill="both",
        expand=True,
        padx=(10, 0),
        pady=10
    )
    scrollbar.pack(side="right", fill="y", pady=10, padx=(0, 10))


# --------------------------------------------------
# SHOW BMI TREND GRAPH
# --------------------------------------------------
def show_bmi_graph():
    user_name = name_entry.get().strip()

    if not user_name:
        messagebox.showwarning(
            "Missing Name",
            "Enter a user's name to view that user's BMI graph."
        )
        return

    conn = None
    try:
        conn = sqlite3.connect(DB_NAME)
        records = conn.execute(
            """
            SELECT recorded_at, bmi
            FROM bmi_records
            WHERE LOWER(user_name) = LOWER(?)
            ORDER BY recorded_at, id
            """,
            (user_name,)
        ).fetchall()

    except sqlite3.Error as error:
        messagebox.showerror(
            "Database Error",
            f"Could not load BMI graph data:\n{error}"
        )
        return

    finally:
        if conn is not None:
            conn.close()

    if not records:
        messagebox.showinfo(
            "No Records",
            f"No BMI records were found for {user_name}. Save at least one record first."
        )
        return

    try:
        dates = [
            datetime.strptime(record[0], "%Y-%m-%d %H:%M:%S")
            for record in records
        ]
        bmi_values = [record[1] for record in records]
    except (TypeError, ValueError) as error:
        messagebox.showerror(
            "Data Error",
            f"Could not read a saved date from the database:\n{error}"
        )
        return

    graph_window = tk.Toplevel(root)
    graph_window.title(f"{user_name} - BMI Trend")
    graph_window.geometry("850x550")

    figure = Figure(figsize=(8, 5), dpi=100)
    ax = figure.add_subplot(111)

    ax.plot(
        dates,
        bmi_values,
        marker="o",
        linewidth=2,
        label="BMI History"
    )
    ax.axhspan(
        18.5,
        25,
        alpha=0.15,
        label="Normal adult BMI range"
    )

    ax.set_title(f"BMI Trend for {user_name}")
    ax.set_xlabel("Date and Time")
    ax.set_ylabel("BMI")
    ax.grid(True, linestyle="--", alpha=0.4)
    ax.legend()

    figure.autofmt_xdate()

    canvas = FigureCanvasTkAgg(figure, master=graph_window)
    canvas.draw()
    canvas.get_tk_widget().pack(fill="both", expand=True)


# --------------------------------------------------
# MAIN GUI WINDOW
# --------------------------------------------------
root = tk.Tk()
root.title("Advanced BMI Calculator")
root.geometry("520x650")
root.resizable(False, False)
root.configure(bg="#f0f4f8")

# Initialize the database after creating the main Tkinter window.
DB_READY = initialize_database()

# Heading
tk.Label(
    root,
    text="BMI CALCULATOR",
    font=("Arial", 22, "bold"),
    bg="#f0f4f8",
    fg="#1e3a5f"
).pack(pady=20)

# User name
tk.Label(
    root,
    text="User Name",
    font=("Arial", 12),
    bg="#f0f4f8"
).pack()
name_entry = tk.Entry(root, font=("Arial", 12), justify="center")
name_entry.pack(pady=7)

# Weight
tk.Label(
    root,
    text="Weight (kg)",
    font=("Arial", 12),
    bg="#f0f4f8"
).pack()
weight_entry = tk.Entry(root, font=("Arial", 12), justify="center")
weight_entry.pack(pady=7)

# Height
tk.Label(
    root,
    text="Height (meters)",
    font=("Arial", 12),
    bg="#f0f4f8"
).pack()
height_entry = tk.Entry(root, font=("Arial", 12), justify="center")
height_entry.pack(pady=7)

# Calculate button
tk.Button(
    root,
    text="Calculate BMI",
    font=("Arial", 11, "bold"),
    bg="#2563eb",
    fg="white",
    padx=15,
    pady=7,
    command=calculate_bmi
).pack(pady=10)

# Save record button
tk.Button(
    root,
    text="Save Record",
    font=("Arial", 11, "bold"),
    bg="#16a34a",
    fg="white",
    padx=15,
    pady=7,
    command=save_record,
    state=tk.NORMAL if DB_READY else tk.DISABLED
).pack(pady=5)

# View history button
tk.Button(
    root,
    text="View BMI History",
    font=("Arial", 11, "bold"),
    bg="#475569",
    fg="white",
    padx=15,
    pady=7,
    command=show_history
).pack(pady=5)

# View graph button (this belongs in the main window, not inside show_history).
tk.Button(
    root,
    text="View BMI Trend Graph",
    font=("Arial", 11, "bold"),
    bg="#7c3aed",
    fg="white",
    padx=15,
    pady=7,
    command=show_bmi_graph
).pack(pady=5)

# Result display
result_label = tk.Label(
    root,
    text="Enter your details to calculate BMI",
    font=("Arial", 13, "bold"),
    bg="#f0f4f8",
    fg="#333333",
    justify="center"
)
result_label.pack(pady=15)

# Start the application
root.mainloop()

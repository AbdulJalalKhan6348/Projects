// =========================
// GET HTML ELEMENTS
// =========================

const taskForm = document.getElementById("taskForm");

const taskInput = document.getElementById("taskInput");

const pendingList = document.getElementById("pendingList");

const completedList = document.getElementById("completedList");

const pendingCount = document.getElementById("pendingCount");

const completedCount = document.getElementById("completedCount");

const totalPending = document.getElementById("totalPending");

const totalCompleted = document.getElementById("totalCompleted");

const pendingEmpty = document.getElementById("pendingEmpty");

const completedEmpty = document.getElementById("completedEmpty");

const statusMessage = document.getElementById("statusMessage");

const taskColumns = document.querySelector(".task-columns");


// =========================
// STORAGE SETTINGS
// =========================

const STORAGE_KEY = "myTodoTasks";


// Load Existing Tasks
function loadTasks() {

    try {

        const savedTasks = localStorage.getItem(STORAGE_KEY);

        if (!savedTasks) {
            return [];
        }

        const parsedTasks = JSON.parse(savedTasks);

        if (!Array.isArray(parsedTasks)) {
            return [];
        }

        return parsedTasks
            .filter(task =>
                task &&
                typeof task.id === "string" &&
                typeof task.text === "string" &&
                typeof task.completed === "boolean"
            )
            .map(task => ({
                id: task.id,
                text: task.text,
                completed: task.completed,
                createdAt: task.createdAt || new Date().toISOString(),
                completedAt: task.completedAt || null
            }));

    } catch (error) {

        console.error("Error loading tasks:", error);

        return [];
    }
}


// Store Tasks in Browser
let tasks = loadTasks();

let editingTaskId = null;


// Save Tasks
function saveTasks() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(tasks)
        );

        return true;

    } catch (error) {

        console.error("Unable to save tasks:", error);

        statusMessage.textContent =
            "Unable to save tasks in this browser.";

        return false;
    }
}


// =========================
// GENERATE TASK ID
// =========================

function generateId() {

    if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }

    return Date.now().toString() +
        Math.random().toString(16).slice(2);
}


// =========================
// FORMAT DATE AND TIME
// =========================

function formatDate(dateString) {

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "Unknown time";
    }

    return date.toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short"
    });
}


// =========================
// CREATE BUTTON
// =========================

function createButton(text, action, className) {

    const button = document.createElement("button");

    button.type = "button";

    button.textContent = text;

    button.dataset.action = action;

    button.className = "action-btn " + className;

    return button;
}


// =========================
// CREATE TASK CARD
// =========================

function createTaskCard(task) {

    const card = document.createElement("article");

    card.className = "task-item";

    card.dataset.id = task.id;

    if (task.completed) {
        card.classList.add("completed");
    }


    // INLINE EDIT FORM
    if (editingTaskId === task.id) {

        const editForm = document.createElement("form");

        editForm.className = "edit-form";

        editForm.dataset.editForm = "true";


        const editInput = document.createElement("input");

        editInput.type = "text";

        editInput.className = "edit-input";

        editInput.value = task.text;

        editInput.maxLength = 200;

        editInput.required = true;

        editInput.setAttribute(
            "aria-label",
            "Edit task description"
        );


        const editActions = document.createElement("div");

        editActions.className = "edit-actions";


        const saveButton = document.createElement("button");

        saveButton.type = "submit";

        saveButton.textContent = "Save";

        saveButton.className = "action-btn save-btn";


        const cancelButton = createButton(
            "Cancel",
            "cancel",
            "cancel-btn"
        );


        editActions.append(saveButton, cancelButton);

        editForm.append(editInput, editActions);

        card.appendChild(editForm);

        return card;
    }


    // TASK INFORMATION
    const taskText = document.createElement("p");

    taskText.className = "task-text";

    taskText.textContent = task.text;


    const taskDate = document.createElement("p");

    taskDate.className = "task-date";

    taskDate.textContent =
        "Added: " + formatDate(task.createdAt);


    // Completed Timestamp
    if (task.completed && task.completedAt) {

        const completedDate = document.createElement("p");

        completedDate.className = "task-date";

        completedDate.textContent =
            "Completed: " + formatDate(task.completedAt);

        card.append(taskText, taskDate, completedDate);

    } else {

        card.append(taskText, taskDate);
    }


    // TASK BUTTONS
    const taskActions = document.createElement("div");

    taskActions.className = "task-actions";


    // Complete / Pending Button
    const toggleButton = createButton(
        task.completed ? "↩ Move to Pending" : "✓ Mark Complete",
        "toggle",
        "complete-btn"
    );


    // Edit Button
    const editButton = createButton(
        "✎ Edit",
        "edit",
        "edit-btn"
    );


    // Delete Button
    const deleteButton = createButton(
        "✕ Delete",
        "delete",
        "delete-btn"
    );


    taskActions.append(
        toggleButton,
        editButton,
        deleteButton
    );

    card.appendChild(taskActions);

    return card;
}


// =========================
// RENDER TASK LISTS
// =========================

function renderTasks() {

    // Clear Previous Lists
    pendingList.replaceChildren();

    completedList.replaceChildren();


    // Separate Tasks
    const pendingTasks = tasks.filter(task => !task.completed);

    const completedTasks = tasks.filter(task => task.completed);


    // Display Pending Tasks
    pendingTasks.forEach(task => {

        const taskCard = createTaskCard(task);

        pendingList.appendChild(taskCard);
    });


    // Display Completed Tasks
    completedTasks.forEach(task => {

        const taskCard = createTaskCard(task);

        completedList.appendChild(taskCard);
    });


    // Update Counters
    pendingCount.textContent =
        `${pendingTasks.length} pending`;

    completedCount.textContent =
        `${completedTasks.length} completed`;


    totalPending.textContent = pendingTasks.length;

    totalCompleted.textContent = completedTasks.length;


    // Show Empty Messages
    pendingEmpty.hidden = pendingTasks.length !== 0;

    completedEmpty.hidden = completedTasks.length !== 0;

}


// =========================
// ADD NEW TASK
// =========================

taskForm.addEventListener("submit", function(event) {

    event.preventDefault();

    const taskText = taskInput.value.trim();


    // Check Empty Input
    if (taskText === "") {

        statusMessage.textContent =
            "Please enter a task before adding.";

        taskInput.focus();

        return;
    }


    // Create New Task
    const newTask = {

        id: generateId(),

        text: taskText,

        completed: false,

        createdAt: new Date().toISOString(),

        completedAt: null

    };


    // Add to Pending Tasks
    tasks.unshift(newTask);


    // Save and Update
    saveTasks();

    editingTaskId = null;

    renderTasks();


    // Reset Input
    taskForm.reset();

    taskInput.focus();

    statusMessage.textContent = "Task added successfully!";

});


// =========================
// TASK BUTTON CLICK EVENTS
// =========================

// One event listener handles the dynamically created buttons.
taskColumns.addEventListener("click", function(event) {

    const button = event.target.closest("button[data-action]");

    if (!button) {
        return;
    }

    const card = button.closest(".task-item");

    if (!card) {
        return;
    }

    const taskId = card.dataset.id;

    const action = button.dataset.action;

    const task = tasks.find(item => item.id === taskId);

    if (!task) {
        return;
    }


    // Handle Button Actions
    switch (action) {


        // MARK COMPLETE OR PENDING
        case "toggle":

            task.completed = !task.completed;

            task.completedAt = task.completed
                ? new Date().toISOString()
                : null;

            editingTaskId = null;

            saveTasks();

            renderTasks();

            statusMessage.textContent = task.completed
                ? "Task marked as completed!"
                : "Task moved back to pending.";

            break;


        // EDIT TASK
        case "edit":

            editingTaskId = taskId;

            renderTasks();

            const editInput =
                taskColumns.querySelector(".edit-input");

            if (editInput) {

                editInput.focus();

                editInput.select();
            }

            statusMessage.textContent = "";

            break;


        // DELETE TASK
        case "delete":

            tasks = tasks.filter(item => item.id !== taskId);

            if (editingTaskId === taskId) {
                editingTaskId = null;
            }

            saveTasks();

            renderTasks();

            statusMessage.textContent = "Task deleted successfully!";

            break;


        // CANCEL EDITING
        case "cancel":

            editingTaskId = null;

            renderTasks();

            statusMessage.textContent = "Editing cancelled.";

            break;

    }

});


// =========================
// SAVE EDITED TASK
// =========================

taskColumns.addEventListener("submit", function(event) {

    if (!event.target.matches("form[data-edit-form]")) {
        return;
    }

    event.preventDefault();

    const card = event.target.closest(".task-item");

    const taskId = card.dataset.id;

    const newText = event.target
        .querySelector(".edit-input")
        .value.trim();


    // Validate Edited Text
    if (newText === "") {

        statusMessage.textContent =
            "Task name cannot be empty.";

        event.target.querySelector(".edit-input").focus();

        return;
    }


    // Update Task
    const task = tasks.find(item => item.id === taskId);

    if (!task) {
        return;
    }

    task.text = newText;

    editingTaskId = null;


    // Save and Render
    saveTasks();

    renderTasks();

    statusMessage.textContent = "Task updated successfully!";

});


// =========================
// CANCEL EDIT USING ESCAPE
// =========================

taskColumns.addEventListener("keydown", function(event) {

    if (
        event.key === "Escape" &&
        event.target.classList.contains("edit-input")
    ) {

        editingTaskId = null;

        renderTasks();

        statusMessage.textContent = "Editing cancelled.";
    }

});


// =========================
// CLEAR STATUS MESSAGE
// =========================

taskInput.addEventListener("input", function() {

    statusMessage.textContent = "";

});


// =========================
// INITIAL PAGE LOAD
// =========================

renderTasks();
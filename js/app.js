// Initialize IndexedDB
let db;
const dbName = "SMARTGoalsDB";
const dbVersion = 1;

// Track last export date
let lastExportDate = localStorage.getItem('lastExportDate') || null;

function initializeDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);

        request.onerror = (event) => {
            console.error("Database error:", event.target.error);
            reject("Error opening database");
        };

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            
            // Create goals object store if it doesn't exist
            if (!db.objectStoreNames.contains("goals")) {
                const goalsStore = db.createObjectStore("goals", { keyPath: "id", autoIncrement: true });
                goalsStore.createIndex("title", "title", { unique: false });
                goalsStore.createIndex("status", "status", { unique: false });
                goalsStore.createIndex("type", "type", { unique: false });
            }
            
            // Create tasks object store if it doesn't exist
            if (!db.objectStoreNames.contains("tasks")) {
                const tasksStore = db.createObjectStore("tasks", { keyPath: "id", autoIncrement: true });
                tasksStore.createIndex("goalId", "goalId", { unique: false });
                tasksStore.createIndex("completed", "completed", { unique: false });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("Database opened successfully");
            resolve(db);
        };
    });
}

// Wait for DOM and DB to be ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initializeDB();
        loadGoals();
        console.log("Application initialized successfully");
    } catch (error) {
        console.error("Failed to initialize application:", error);
        alert("There was an error initializing the application. Please refresh the page.");
    }
});

// SMART Goal Form Handler
document.getElementById("smartGoalForm").addEventListener("submit", (e) => {
    e.preventDefault();
    
    const goal = {
        title: document.getElementById("goalTitle").value,
        type: document.getElementById("goalType").value,
        specific: document.getElementById("specific").value,
        measurable: document.getElementById("measurable").value,
        achievable: document.getElementById("achievable").value,
        relevant: document.getElementById("relevant").value,
        timeBound: document.getElementById("timeBound").value,
        status: "active",
        progress: 0,
        createdAt: new Date().toISOString()
    };
    
    const form = e.target;
    const isEditMode = form.dataset.editMode === 'true';
    const editGoalId = parseInt(form.dataset.editGoalId);
    
    const transaction = db.transaction(["goals"], "readwrite");
    const store = transaction.objectStore("goals");
    
    if (isEditMode) {
        // Get existing goal to preserve certain properties
        store.get(editGoalId).onsuccess = (event) => {
            const existingGoal = event.target.result;
            goal.id = editGoalId;
            goal.progress = existingGoal.progress;
            goal.status = existingGoal.status;
            goal.createdAt = existingGoal.createdAt;
            
            store.put(goal).onsuccess = () => {
                form.dataset.editMode = 'false';
                form.dataset.editGoalId = '';
                form.reset();
                loadGoals();
            };
        };
    } else {
        store.add(goal).onsuccess = () => {
            form.reset();
            loadGoals();
        };
    }
});

// Load and Display Goals
function loadGoals(filter = "all") {
    const transaction = db.transaction(["goals"], "readonly");
    const store = transaction.objectStore("goals");
    const request = store.getAll();
    
    request.onsuccess = () => {
        const goals = request.result;
        const container = document.getElementById("goalsContainer");
        container.innerHTML = "";
        
        goals.forEach(goal => {
            if (filter === "all" || 
                (filter === "completed" && goal.status === "completed") ||
                (filter === "active" && goal.status === "active")) {
                
                const goalElement = createGoalElement(goal);
                container.appendChild(goalElement);
            }
        });
    };
}

// Create Goal Element
function createGoalElement(goal) {
    const div = document.createElement("div");
    div.className = `card goal-card ${goal.status === "completed" ? "completed" : ""}`;
    
    const dueDate = new Date(goal.timeBound);
    const isOverdue = dueDate < new Date() && goal.status !== "completed";
    
    if (isOverdue) div.classList.add("overdue");
    
    div.innerHTML = `
        <div class="card-body">
            <div class="d-flex justify-content-between align-items-center">
                <h5 class="card-title">${goal.title}</h5>
                <div>
                    <span class="badge bg-secondary me-2">${goal.type}</span>
                    <span class="badge ${goal.status === "completed" ? "bg-success" : isOverdue ? "bg-danger" : "bg-primary"}">
                        ${goal.status === "completed" ? "Completed" : isOverdue ? "Overdue" : "In Progress"}
                    </span>
                </div>
            </div>
            <div class="progress mt-2">
                <div class="progress-bar" role="progressbar" style="width: ${goal.progress}%"
                     aria-valuenow="${goal.progress}" aria-valuemin="0" aria-valuemax="100">
                    ${goal.progress}%
                </div>
            </div>
            <div class="mt-2">
                <small class="text-muted">Due: ${new Date(goal.timeBound).toLocaleDateString()}</small>
            </div>
            <div class="mt-2">
                <button class="btn btn-sm btn-primary" onclick="viewGoalDetails(${goal.id})">
                    View Details
                </button>
                <button class="btn btn-sm btn-warning" onclick="editGoal(${goal.id})">
                    Edit
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteGoal(${goal.id})">
                    Delete
                </button>
                <button class="btn btn-sm ${goal.status === "completed" ? "btn-secondary" : "btn-success"}"
                        onclick="toggleGoalStatus(${goal.id})">
                    ${goal.status === "completed" ? "Reopen" : "Mark Complete"}
                </button>
            </div>
        </div>
    `;
    
    return div;
}

// Delete Goal
function deleteGoal(goalId) {
    if (!confirm('Are you sure you want to delete this goal? This action cannot be undone.')) {
        return;
    }

    const transaction = db.transaction(['goals', 'tasks'], 'readwrite');
    const goalStore = transaction.objectStore('goals');
    const taskStore = transaction.objectStore('tasks');
    const taskIndex = taskStore.index('goalId');

    // First, delete all tasks associated with this goal
    const taskRequest = taskIndex.getAll(goalId);
    
    taskRequest.onsuccess = (event) => {
        const tasks = event.target.result;
        tasks.forEach(task => {
            taskStore.delete(task.id);
        });

        // Then delete the goal
        goalStore.delete(goalId).onsuccess = () => {
            loadGoals();
            const modal = bootstrap.Modal.getInstance(document.getElementById('goalDetailsModal'));
            if (modal) {
                modal.hide();
            }
        };
    };
}

// Edit Goal
function editGoal(goalId) {
    const transaction = db.transaction(['goals'], 'readonly');
    const store = transaction.objectStore('goals');
    
    store.get(goalId).onsuccess = (event) => {
        const goal = event.target.result;
        
        // Populate form with existing goal data
        document.getElementById('goalTitle').value = goal.title;
        document.getElementById('goalType').value = goal.type;
        document.getElementById('specific').value = goal.specific;
        document.getElementById('measurable').value = goal.measurable;
        document.getElementById('achievable').value = goal.achievable;
        document.getElementById('relevant').value = goal.relevant;
        document.getElementById('timeBound').value = goal.timeBound.split('T')[0];
        
        // Update form submission handler
        const form = document.getElementById('smartGoalForm');
        form.dataset.editMode = 'true';
        form.dataset.editGoalId = goalId;
        
        // Close the details modal if it's open
        const detailsModal = bootstrap.Modal.getInstance(document.getElementById('goalDetailsModal'));
        if (detailsModal) {
            detailsModal.hide();
        }
        
        // Scroll to the form
        form.scrollIntoView({ behavior: 'smooth' });
    };
}

// View Goal Details
function viewGoalDetails(goalId) {
    console.log("Viewing details for goal:", goalId);
    const transaction = db.transaction(["goals", "tasks"], "readonly");
    const goalStore = transaction.objectStore("goals");
    const taskStore = transaction.objectStore("tasks");
    const taskIndex = taskStore.index("goalId");
    
    goalStore.get(goalId).onsuccess = (event) => {
        const goal = event.target.result;
        console.log("Goal data:", goal);
        const detailsContainer = document.getElementById("goalDetails");
        
        detailsContainer.innerHTML = `
            <h4 data-goal-id="${goalId}">${goal.title}</h4>
            <span class="badge bg-secondary mb-3">${goal.type}</span>
            <div class="smart-criteria">
                <h6>Specific</h6>
                <p>${goal.specific}</p>
                <h6>Measurable</h6>
                <p>${goal.measurable}</p>
                <h6>Achievable</h6>
                <p>${goal.achievable}</p>
                <h6>Relevant</h6>
                <p>${goal.relevant}</p>
                <h6>Time-Bound</h6>
                <p>Due: ${new Date(goal.timeBound).toLocaleDateString()}</p>
            </div>
            <div class="progress mt-3 mb-3">
                <div class="progress-bar" role="progressbar" style="width: ${goal.progress}%"
                     aria-valuenow="${goal.progress}" aria-valuemin="0" aria-valuemax="100">
                    ${goal.progress}%
                </div>
            </div>
        `;
        
        // Load tasks
        loadTasks(goalId);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById("goalDetailsModal"));
        modal.show();
    };
}

// Load Tasks
function loadTasks(goalId) {
    console.log("Loading tasks for goal:", goalId);
    const transaction = db.transaction(["tasks"], "readonly");
    const taskStore = transaction.objectStore("tasks");
    const taskIndex = taskStore.index("goalId");
    const taskList = document.getElementById("taskList");
    
    const request = taskIndex.getAll(goalId);
    
    request.onerror = (event) => {
        console.error("Error loading tasks:", event.target.error);
        taskList.innerHTML = '<div class="text-danger">Error loading tasks</div>';
    };
    
    request.onsuccess = (event) => {
        const tasks = event.target.result;
        console.log("Tasks found:", tasks);
        taskList.innerHTML = "";
        
        if (!tasks || tasks.length === 0) {
            taskList.innerHTML = '<div class="text-muted">No tasks added yet</div>';
            return;
        }
        
        tasks.forEach(task => {
            const taskElement = document.createElement("div");
            taskElement.className = `task-item ${task.completed ? "completed" : ""}`;
            taskElement.innerHTML = `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" 
                           ${task.completed ? "checked" : ""}
                           onchange="toggleTaskStatus(${task.id}, ${goalId})">
                    <label class="form-check-label">${task.title}</label>
                </div>
            `;
            taskList.appendChild(taskElement);
        });
    };
}

// Add Task
document.getElementById("addTaskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = e.target.querySelector("input");
    const goalId = parseInt(document.querySelector("#goalDetails h4").getAttribute("data-goal-id"));
    
    console.log("Adding task for goal:", goalId);
    
    if (!goalId) {
        console.error("No goal ID found");
        return;
    }
    
    const task = {
        goalId: goalId,
        title: input.value,
        completed: false,
        createdAt: new Date().toISOString()
    };
    
    console.log("Creating task:", task);
    
    const transaction = db.transaction(["tasks"], "readwrite");
    const store = transaction.objectStore("tasks");
    
    const request = store.add(task);
    
    request.onerror = (event) => {
        console.error("Error adding task:", event.target.error);
    };
    
    request.onsuccess = (event) => {
        console.log("Task added successfully with ID:", event.target.result);
        input.value = "";
        loadTasks(goalId);
        updateGoalProgress(goalId);
    };
});

// Toggle Task Status
function toggleTaskStatus(taskId, goalId) {
    console.log("Toggling task:", taskId, "for goal:", goalId);
    const transaction = db.transaction(["tasks"], "readwrite");
    const store = transaction.objectStore("tasks");
    
    const request = store.get(taskId);
    
    request.onerror = (event) => {
        console.error("Error getting task:", event.target.error);
    };
    
    request.onsuccess = (event) => {
        const task = event.target.result;
        task.completed = !task.completed;
        
        const updateRequest = store.put(task);
        
        updateRequest.onerror = (event) => {
            console.error("Error updating task:", event.target.error);
        };
        
        updateRequest.onsuccess = () => {
            console.log("Task updated successfully");
            loadTasks(goalId);
            updateGoalProgress(goalId);
        };
    };
}

// Update Goal Progress
function updateGoalProgress(goalId) {
    console.log("Updating progress for goal:", goalId);
    const transaction = db.transaction(["goals", "tasks"], "readwrite");
    const taskStore = transaction.objectStore("tasks");
    const goalStore = transaction.objectStore("goals");
    const taskIndex = taskStore.index("goalId");
    
    const taskRequest = taskIndex.getAll(goalId);
    
    taskRequest.onerror = (event) => {
        console.error("Error getting tasks for progress:", event.target.error);
    };
    
    taskRequest.onsuccess = (event) => {
        const tasks = event.target.result;
        if (!tasks || tasks.length === 0) return;
        
        const completedTasks = tasks.filter(task => task.completed).length;
        const progress = Math.round((completedTasks / tasks.length) * 100);
        
        const goalRequest = goalStore.get(goalId);
        
        goalRequest.onerror = (event) => {
            console.error("Error getting goal for progress:", event.target.error);
        };
        
        goalRequest.onsuccess = (event) => {
            const goal = event.target.result;
            goal.progress = progress;
            
            const updateRequest = goalStore.put(goal);
            
            updateRequest.onerror = (event) => {
                console.error("Error updating goal progress:", event.target.error);
            };
            
            updateRequest.onsuccess = () => {
                console.log("Goal progress updated successfully");
                loadGoals();
            };
        };
    };
}

// Toggle Goal Status
function toggleGoalStatus(goalId) {
    const transaction = db.transaction(["goals"], "readwrite");
    const store = transaction.objectStore("goals");
    
    store.get(goalId).onsuccess = (event) => {
        const goal = event.target.result;
        goal.status = goal.status === "completed" ? "active" : "completed";
        
        store.put(goal).onsuccess = () => {
            loadGoals();
        };
    };
}

// Filter Buttons
document.getElementById("viewAll").addEventListener("click", () => loadGoals("all"));
document.getElementById("viewInProgress").addEventListener("click", () => loadGoals("active"));
document.getElementById("viewCompleted").addEventListener("click", () => loadGoals("completed"));

// Show Reports
function showReports() {
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap is not loaded');
        alert('Error: Could not show reports. Please refresh the page and try again.');
        return;
    }

    const reportsModal = document.getElementById('reportsModal');
    if (!reportsModal) {
        console.error('Reports modal element not found');
        alert('Error: Could not find reports modal. Please refresh the page and try again.');
        return;
    }

    // Initialize charts before showing modal
    initializeCharts();
    
    // Show the modal
    const modal = new bootstrap.Modal(reportsModal);
    modal.show();
    
    // Generate reports after modal is shown
    generateReports();
}

// Initialize Charts
function initializeCharts() {
    // Initialize Status Chart
    const statusCtx = document.getElementById('goalStatusChart');
    if (window.statusChart) {
        window.statusChart.destroy();
    }
    window.statusChart = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: ['In Progress', 'Completed', 'Overdue'],
            datasets: [{
                data: [0, 0, 0], // Initial empty data
                backgroundColor: ['#0d6efd', '#198754', '#dc3545']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    // Initialize Type Chart
    const typeCtx = document.getElementById('goalTypeChart');
    if (window.typeChart) {
        window.typeChart.destroy();
    }
    window.typeChart = new Chart(typeCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Number of Goals',
                data: [],
                backgroundColor: '#0d6efd'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Generate Reports
async function generateReports() {
    try {
        const transaction = db.transaction(["goals", "tasks"], "readonly");
        const goalStore = transaction.objectStore("goals");
        const taskStore = transaction.objectStore("tasks");
        
        // Get all goals
        const goals = await new Promise((resolve, reject) => {
            const request = goalStore.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        // Prepare data for charts
        const statusData = {
            'active': 0,
            'completed': 0,
            'overdue': 0
        };
        
        // Enhanced data tracking
        const typeData = {};
        const categoryStats = {};
        const upcomingDeadlines = [];
        const NOW = new Date();
        const WEEK_FROM_NOW = new Date(NOW.getTime() + (7 * 24 * 60 * 60 * 1000));
        
        const tableBody = document.querySelector("#goalSummaryTable tbody");
        tableBody.innerHTML = "";
        
        // Process each goal
        for (const goal of goals) {
            // Determine status
            const dueDate = new Date(goal.timeBound);
            const isOverdue = dueDate < NOW && goal.status !== "completed";
            const status = isOverdue ? 'overdue' : goal.status;
            statusData[status]++;
            
            // Track upcoming deadlines (within next 7 days)
            if (!isOverdue && dueDate <= WEEK_FROM_NOW) {
                upcomingDeadlines.push({
                    title: goal.title,
                    dueDate: dueDate,
                    progress: goal.progress,
                    type: goal.type
                });
            }
            
            // Enhanced category tracking
            if (!categoryStats[goal.type]) {
                categoryStats[goal.type] = {
                    total: 0,
                    completed: 0,
                    active: 0,
                    overdue: 0,
                    totalProgress: 0
                };
            }
            categoryStats[goal.type].total++;
            categoryStats[goal.type][status]++;
            categoryStats[goal.type].totalProgress += goal.progress;
            
            // Count by type
            typeData[goal.type] = (typeData[goal.type] || 0) + 1;
            
            // Get tasks for this goal
            const tasks = await new Promise((resolve, reject) => {
                const taskIndex = taskStore.index("goalId");
                const request = taskIndex.getAll(goal.id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            
            const completedTasks = tasks.filter(task => task.completed).length;
            
            // Add row to table with enhanced styling
            const row = document.createElement("tr");
            const deadlineClass = isOverdue ? 'table-danger' : 
                                (dueDate <= WEEK_FROM_NOW ? 'table-warning' : '');
            row.className = deadlineClass;
            row.innerHTML = `
                <td>${goal.type}</td>
                <td>${goal.title}</td>
                <td>
                    <span class="badge ${goal.status === "completed" ? "bg-success" : status === 'overdue' ? "bg-danger" : "bg-primary"}">
                        ${goal.status === "completed" ? "Completed" : status === 'overdue' ? "Overdue" : "In Progress"}
                    </span>
                </td>
                <td>
                    <div class="progress">
                        <div class="progress-bar" role="progressbar" style="width: ${goal.progress}%" aria-valuenow="${goal.progress}" aria-valuemin="0" aria-valuemax="100">
                            ${goal.progress}%
                        </div>
                    </div>
                </td>
                <td>${dueDate.toLocaleDateString()}</td>
                <td>${completedTasks}/${tasks.length}</td>
            `;
            tableBody.appendChild(row);
        }

        // Generate category statistics summary
        const categoryStatsDiv = document.getElementById('categoryStats');
        categoryStatsDiv.innerHTML = '<h4>Category Statistics</h4>';
        for (const [category, stats] of Object.entries(categoryStats)) {
            const avgProgress = (stats.totalProgress / stats.total).toFixed(1);
            categoryStatsDiv.innerHTML += `
                <div class="card mb-2">
                    <div class="card-body">
                        <h5 class="card-title">${category}</h5>
                        <p class="card-text">
                            Average Progress: ${avgProgress}%<br>
                            Total Goals: ${stats.total}<br>
                            Completed: ${stats.completed}<br>
                            Active: ${stats.active}<br>
                            Overdue: ${stats.overdue}
                        </p>
                    </div>
                </div>
            `;
        }

        // Display upcoming deadlines
        const deadlinesDiv = document.getElementById('upcomingDeadlines');
        deadlinesDiv.innerHTML = '<h4>Upcoming Deadlines (Next 7 Days)</h4>';
        if (upcomingDeadlines.length > 0) {
            upcomingDeadlines.sort((a, b) => a.dueDate - b.dueDate);
            deadlinesDiv.innerHTML += `
                <div class="list-group">
                    ${upcomingDeadlines.map(goal => `
                        <div class="list-group-item">
                            <div class="d-flex w-100 justify-content-between">
                                <h5 class="mb-1">${goal.title}</h5>
                                <small>${goal.dueDate.toLocaleDateString()}</small>
                            </div>
                            <p class="mb-1">Type: ${goal.type} | Progress: ${goal.progress}%</p>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            deadlinesDiv.innerHTML += '<p>No upcoming deadlines in the next 7 days.</p>';
        }
        
        // Update Status Chart
        window.statusChart.data.datasets[0].data = [
            statusData.active,
            statusData.completed,
            statusData.overdue
        ];
        window.statusChart.update();
        
        // Update Type Chart
        window.typeChart.data.labels = Object.keys(typeData);
        window.typeChart.data.datasets[0].data = Object.values(typeData);
        window.typeChart.update();
        
    } catch (error) {
        console.error("Error generating reports:", error);
        alert("Error generating reports. Please try again.");
    }
}

// Export Report as PDF
async function exportReportAsPDF() {
    try {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            alert('PDF library not loaded. Please refresh the page.');
            return;
        }

        // Create PDF
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        
        // Title
        doc.setFontSize(24);
        doc.text('SMART Goals Report', pageWidth/2, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text(new Date().toLocaleDateString(), pageWidth/2, 30, { align: 'center' });

        // Add Goal Summary Table
        const table = document.getElementById('goalSummaryTable');
        if (table) {
            const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent);
            const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => 
                Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
            );

            doc.autoTable({
                head: [headers],
                body: rows,
                startY: 40,
                margin: { top: 30 },
                styles: { 
                    overflow: 'linebreak',
                    cellPadding: 2,
                    fontSize: 10
                },
                columnStyles: {
                    0: { cellWidth: 30 }, // Type
                    1: { cellWidth: 'auto' }, // Title
                    2: { cellWidth: 25 }, // Status
                    3: { cellWidth: 25 }, // Progress
                    4: { cellWidth: 30 }, // Due Date
                    5: { cellWidth: 25 } // Tasks
                }
            });
        }

        // Save the PDF
        doc.save('SCOFIELD-Goal-Report.pdf');

    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Error generating PDF report: ' + error.message);
    }
}

// For backward compatibility
const exportReport = exportReportAsPDF;

// Export Goals as JSON backup
async function exportGoals() {
    try {
        const transaction = db.transaction(["goals", "tasks"], "readonly");
        const goalStore = transaction.objectStore("goals");
        const taskStore = transaction.objectStore("tasks");
        
        // Get all goals and tasks
        const goals = await new Promise((resolve) => {
            goalStore.getAll().onsuccess = (event) => resolve(event.target.result);
        });
        
        const tasks = await new Promise((resolve) => {
            taskStore.getAll().onsuccess = (event) => resolve(event.target.result);
        });
        
        // Create backup object
        const backup = {
            version: "1.0",
            timestamp: new Date().toISOString(),
            data: {
                goals: goals,
                tasks: tasks
            }
        };
        
        // Convert to JSON and create blob
        const jsonString = JSON.stringify(backup, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `scofield_backup_${new Date().toISOString().split('T')[0]}.json`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // Update last export date
        localStorage.setItem('lastExportDate', new Date().toISOString());
        
    } catch (error) {
        console.error("Error exporting goals:", error);
        alert("Error exporting goals. Please try again.");
    }
}

// Import Goals
function importGoals() {
    if (!db) {
        alert("Database not ready. Please try again in a moment.");
        return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = (event) => {
            try {
                const backup = JSON.parse(event.target.result);
                console.log("Importing backup:", backup);
                
                // Validate backup format
                if (!backup.version || !backup.data || !backup.data.goals || !Array.isArray(backup.data.goals)) {
                    throw new Error("Invalid backup file format");
                }
                
                const transaction = db.transaction(["goals", "tasks"], "readwrite");
                const goalStore = transaction.objectStore("goals");
                const taskStore = transaction.objectStore("tasks");
                
                // Clear existing data
                goalStore.clear().onsuccess = () => {
                    taskStore.clear().onsuccess = () => {
                        // Import goals
                        backup.data.goals.forEach(goal => {
                            goalStore.add(goal);
                        });
                        
                        // Import tasks if they exist
                        if (backup.data.tasks && Array.isArray(backup.data.tasks)) {
                            backup.data.tasks.forEach(task => {
                                taskStore.add(task);
                            });
                        }
                    };
                };
                
                transaction.oncomplete = () => {
                    alert("Goals and tasks imported successfully!");
                    loadGoals();
                };
                
                transaction.onerror = (error) => {
                    console.error("Transaction error:", error);
                    alert("Error importing goals: " + error.target.error);
                };
                
            } catch (error) {
                console.error("Import error:", error);
                alert("Error importing goals. Please make sure you selected a valid backup file.");
            }
        };
        
        reader.onerror = (error) => {
            console.error("File reading error:", error);
            alert("Error reading the backup file.");
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// Show Instructions
function showInstructions() {
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap is not loaded');
        alert('Error: Could not show instructions. Please refresh the page and try again.');
        return;
    }
    const instructionsModal = document.getElementById("instructionsModal");
    if (!instructionsModal) {
        console.error('Instructions modal element not found');
        alert('Error: Could not find instructions modal. Please refresh the page and try again.');
        return;
    }
    const modal = new bootstrap.Modal(instructionsModal);
    modal.show();
}

// Check if backup is needed
function isBackupNeeded() {
    if (!lastExportDate) return true;
    
    const lastExport = new Date(lastExportDate);
    const now = new Date();
    const daysSinceLastExport = Math.floor((now - lastExport) / (1000 * 60 * 60 * 24));
    
    // Return true if it's been more than 7 days since last export
    return daysSinceLastExport > 7;
}

// Add beforeunload event listener
window.addEventListener('beforeunload', (event) => {
    if (isBackupNeeded()) {
        const message = 'You haven\'t backed up your goals in a while. Are you sure you want to leave?';
        event.returnValue = message;
        return message;
    }
});

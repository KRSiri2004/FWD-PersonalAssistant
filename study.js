document.addEventListener('DOMContentLoaded', () => {
    const taskForm = document.getElementById('task-form');
    const taskTitleInput = document.getElementById('task-title');
    const taskSubjectInput = document.getElementById('task-subject');
    const taskDurationHoursInput = document.getElementById('task-duration-hours');
    const taskDurationMinutesInput = document.getElementById('task-duration-minutes');
    const taskDueDateInput = document.getElementById('task-due-date');
    const taskPriorityInput = document.getElementById('task-priority');
    const generateScheduleBtn = document.getElementById('generate-schedule-btn');
    const scheduleContainer = document.getElementById('schedule-container');
    const unscheduledList = document.getElementById('unscheduled-list');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');

    const TIME_SLOTS_CONFIG = {
        morning: { name: '🌅 Morning', capacity: 240, start: 9,  end: 13 },
        evening: { name: '☀️ Evening', capacity: 180, start: 17, end: 20 },
        night:   { name: '🌙 Night',   capacity: 120, start: 21, end: 23 },
    };

    let allTasks = JSON.parse(localStorage.getItem('tasks')) || [];
    taskForm.addEventListener('submit', addTask);
    generateScheduleBtn.addEventListener('click', renderFullSchedule);
    document.body.addEventListener('click', handleTaskActions);
    themeToggleBtn.addEventListener('click', toggleTheme);

    function toYYYYMMDD(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggleBtn.textContent = '🌙';
        } else {
            document.body.classList.remove('dark-mode');
            themeToggleBtn.textContent = '☀️';
        }
    }

    function toggleTheme() {
        const isDark = document.body.classList.contains('dark-mode');
        const newTheme = isDark ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    }
    
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(prefersDark ? 'dark' : 'light');
    }
    
    function addTask(e) {
        e.preventDefault();
        const hours = parseInt(taskDurationHoursInput.value) || 0;
        const minutes = parseInt(taskDurationMinutesInput.value) || 0;
        const totalDuration = (hours * 60) + minutes;
        const newTask = {
            id: Date.now(),
            title: taskTitleInput.value.trim(),
            subject: taskSubjectInput.value.trim(),
            duration: totalDuration,
            dueDate: taskDueDateInput.value,
            priority: taskPriorityInput.value,
            completed: false,
            scheduledDate: null,
            scheduledSlot: null,
        };
        if (!newTask.title || !newTask.dueDate || totalDuration <= 0) {
            alert('Please fill out title, due date, and a valid duration.');
            return;
        }
        allTasks.push(newTask);
        saveTasks();
        renderUnscheduledTasks();
        taskForm.reset();
    }

    function generateSchedule() {
        let unscheduledTasks = allTasks.filter(task => !task.completed && !task.scheduledDate);
        unscheduledTasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        const schedule = {};
        const dailyLoad = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < 60; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateString = toYYYYMMDD(date); 
            schedule[dateString] = { morning: { tasks: [], used: 0 }, evening: { tasks: [], used: 0 }, night: { tasks: [], used: 0 } };
            dailyLoad[dateString] = 0;
        }
        
        allTasks.filter(t => t.scheduledDate).forEach(task => {
            if (!schedule[task.scheduledDate]) {
                 schedule[task.scheduledDate] = { morning: { tasks: [], used: 0 }, evening: { tasks: [], used: 0 }, night: { tasks: [], used: 0 } };
                 dailyLoad[task.scheduledDate] = 0;
            }
        });

        allTasks.filter(t => t.scheduledDate).forEach(task => {
            if (schedule[task.scheduledDate]) {
                const slot = schedule[task.scheduledDate][task.scheduledSlot];
                slot.tasks.push(task);
                slot.used += task.duration;
                dailyLoad[task.scheduledDate] += task.duration;
            }
        });

        unscheduledTasks.forEach(task => {
            const taskDueDate = new Date(task.dueDate + 'T00:00:00');
            const oneWeekBeforeDueDate = new Date(taskDueDate);
            oneWeekBeforeDueDate.setDate(taskDueDate.getDate() - 7);
            const earliestStartDate = new Date(Math.max(today, oneWeekBeforeDueDate));
            earliestStartDate.setHours(0, 0, 0, 0);

            let bestDay = null;
            let minLoad = Infinity;
            let currentDate = new Date(earliestStartDate);
            while (currentDate <= taskDueDate) {
                const dateString = toYYYYMMDD(currentDate);
                if (!schedule[dateString]) {
                    currentDate.setDate(currentDate.getDate() + 1);
                    continue;
                }

                const isToday = (dateString === toYYYYMMDD(today));
                const currentHour = new Date().getHours();
                
                const canFit = Object.keys(TIME_SLOTS_CONFIG).some(slotKey => {
                    if (isToday && currentHour >= TIME_SLOTS_CONFIG[slotKey].end) {
                        return false;
                    }
                    const slot = schedule[dateString][slotKey];
                    return (slot.used + task.duration) <= TIME_SLOTS_CONFIG[slotKey].capacity;
                });

                if (canFit && dailyLoad[dateString] < minLoad) {
                    minLoad = dailyLoad[dateString];
                    bestDay = dateString;
                }

                currentDate.setDate(currentDate.getDate() + 1);
            }

            if (bestDay) {
                const isBestDayToday = (bestDay === toYYYYMMDD(today));
                const currentHour = new Date().getHours();
                for (const slotKey in TIME_SLOTS_CONFIG) {
                    if (isBestDayToday && currentHour >= TIME_SLOTS_CONFIG[slotKey].end) {
                        continue;
                    }
                    const slot = schedule[bestDay][slotKey];
                    if ((slot.used + task.duration) <= TIME_SLOTS_CONFIG[slotKey].capacity) {
                        slot.tasks.push(task);
                        slot.used += task.duration;
                        task.scheduledDate = bestDay;
                        task.scheduledSlot = slotKey;
                        dailyLoad[bestDay] += task.duration;
                        break;
                    }
                }
            }
        });

        saveTasks();
        return schedule;
    }

    function renderFullSchedule() {
        const schedule = generateSchedule();
        scheduleContainer.innerHTML = '';
        Object.keys(schedule).sort().forEach(dateString => {
            const day = schedule[dateString];
            const tasksInDay = day.morning.tasks.length + day.evening.tasks.length + day.night.tasks.length;
            if (tasksInDay === 0) return;
            const dayEl = document.createElement('div');
            dayEl.className = 'day-schedule';
            const formattedDate = new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'});
            dayEl.innerHTML = `<h3>${formattedDate}</h3>`;
            for (const slotKey in day) {
                const slot = day[slotKey];
                if (slot.tasks.length > 0) {
                    const slotEl = document.createElement('div');
                    slotEl.className = 'time-slot';
                    slotEl.innerHTML = `<h4>${TIME_SLOTS_CONFIG[slotKey].name}</h4>`;
                    slot.tasks.forEach(task => {
                        slotEl.appendChild(createTaskElement(task));
                    });
                    dayEl.appendChild(slotEl);
                }
            }
            scheduleContainer.appendChild(dayEl);
        });
        renderUnscheduledTasks();
    }

    function renderUnscheduledTasks() {
        unscheduledList.innerHTML = '';
        const unscheduled = allTasks.filter(task => !task.scheduledDate && !task.completed);
        if (unscheduled.length > 0) {
            unscheduled.forEach(task => {
                unscheduledList.appendChild(createTaskElement(task));
            });
        } else {
            unscheduledList.innerHTML = '<p style="text-align: center; color: #777;">All tasks have been scheduled!</p>';
        }
    }
    
    function formatDuration(minutes) {
        if (minutes < 60) return `${minutes} minutes`;
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        if (remainingMinutes === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
        return `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minutes`;
    }

    function createTaskElement(task) {
        const taskEl = document.createElement('div');
        taskEl.className = 'task-item';
        taskEl.setAttribute('data-id', task.id);
        taskEl.setAttribute('data-priority', task.priority);
        if (task.completed) taskEl.classList.add('completed');
        taskEl.innerHTML = `
            <div class="task-details">
                <strong>${task.title}</strong>
                <div class="task-duration">${formatDuration(task.duration)} - ${task.subject || 'General'}</div>
            </div>
            <div class="task-actions">
                <button class="complete-btn" title="Mark as complete">✔️</button>
                <button class="delete-btn" title="Delete task">❌</button>
            </div>
        `;
        return taskEl;
    }
    
    function handleTaskActions(e) {
        const taskItem = e.target.closest('.task-item');
        if (!taskItem) return;
        const taskId = Number(taskItem.getAttribute('data-id'));
        const task = allTasks.find(t => t.id === taskId);
        if (!task) return;
        if (e.target.classList.contains('complete-btn')) {
            task.completed = !task.completed;
        } else if (e.target.classList.contains('delete-btn')) {
            allTasks = allTasks.filter(t => t.id !== taskId);
        } else {
            return;
        }
        if(task && !e.target.classList.contains('delete-btn')) {
          task.scheduledDate = null;
          task.scheduledSlot = null;
        }
        saveTasks();
        renderFullSchedule();
    }
    
    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(allTasks));
    }
    
    renderFullSchedule();
});
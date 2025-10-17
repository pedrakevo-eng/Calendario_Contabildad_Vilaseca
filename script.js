document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURACIÓN DE SUPABASE ---
    const SUPABASE_URL = 'https://xzzxodtbgnlsupkcncjb.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6enhvZHRiZ25sc3Vwa2NuY2piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0OTIyMjMsImV4cCI6MjA3NjA2ODIyM30.CnYV46EaxYbLOJ4EcQeYkvzDEecbD_BelymgV1HVicU';

    if (!window.supabase) {
        console.error("Supabase client not loaded.");
        return;
    }
    const { createClient } = window.supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

    // --- 2. ELEMENTOS DEL DOM ---
    const calendarEl = document.getElementById('calendar');
    const modal = document.getElementById('eventModal');
    const addEventBtn = document.getElementById('addEventBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const xCloseModalBtn = document.getElementById('xCloseModalBtn');
    const eventForm = document.getElementById('eventForm');
    const saveEventBtn = document.getElementById('saveEventBtn');
    const deleteEventBtn = document.getElementById('deleteEventBtn');
    const userNameSelect = document.getElementById('userName');
    const modalTitle = document.getElementById('modalTitle');
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notification-text');
    const tasksList = document.getElementById('tasksList');
    const notificationBadge = document.getElementById('notification-badge');
    const tooltipList = document.getElementById('tooltip-list');
    const tasksToggle = document.getElementById('tasksToggle');
    const prioritySelect = document.getElementById('priority');
    const darkModeToggle = document.getElementById('darkModeToggle');
    
    // Modal de confirmación
    const confirmModal = document.getElementById('confirmModal');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    
    // Modal de eventos recurrentes
    const addRecurringBtn = document.getElementById('addRecurringBtn');
    const recurringModal = document.getElementById('recurringEventModal');
    const recurringEventForm = document.getElementById('recurringEventForm');
    const closeRecurringModalBtn = document.getElementById('closeRecurringModalBtn');
    const xCloseRecurringModalBtn = document.getElementById('xCloseRecurringModalBtn');

    let calendar;
    let allEvents = [];
    let currentTaskView = 'upcoming';
    let userEventSource = null;

    const holidays = [
        { title: 'Año Nuevo', date: '2025-01-01', allDay: true, classNames: ['holiday-event', 'holiday-ano-nuevo'] },
        { title: 'Estado Plurinacional', date: '2025-01-22', allDay: true, classNames: ['holiday-event', 'holiday-plurinacional'] },
        { title: 'Lunes de Carnaval', date: '2025-03-03', allDay: true, classNames: ['holiday-event', 'holiday-carnaval'] },
        { title: 'Martes de Carnaval', date: '2025-03-04', allDay: true, classNames: ['holiday-event', 'holiday-carnaval'] },
        { title: 'Viernes Santo', date: '2025-04-18', allDay: true, classNames: ['holiday-event', 'holiday-viernes-santo'] },
        { title: 'Día del Trabajo', date: '2025-05-01', allDay: true, classNames: ['holiday-event', 'holiday-trabajo'] },
        { title: 'Corpus Christi', date: '2025-06-19', allDay: true, classNames: ['holiday-event', 'holiday-corpus'] },
        { title: 'Año Nuevo Aymara', date: '2025-06-21', allDay: true, classNames: ['holiday-event', 'holiday-aymara'] },
        { title: 'Día de la Independencia', date: '2025-08-06', allDay: true, classNames: ['holiday-event', 'holiday-independencia'] },
        { title: 'Día de Todos Santos', date: '2025-11-02', allDay: true, classNames: ['holiday-event', 'holiday-santos'] },
        { title: 'Navidad', date: '2025-12-25', allDay: true, classNames: ['holiday-event', 'holiday-navidad'] },
        { title: 'Año Nuevo', date: '2026-01-01', allDay: true, classNames: ['holiday-event', 'holiday-ano-nuevo'] },
        { title: 'Estado Plurinacional', date: '2026-01-22', allDay: true, classNames: ['holiday-event', 'holiday-plurinacional'] },
        { title: 'Lunes de Carnaval', date: '2026-02-16', allDay: true, classNames: ['holiday-event', 'holiday-carnaval'] },
        { title: 'Martes de Carnaval', date: '2026-02-17', allDay: true, classNames: ['holiday-event', 'holiday-carnaval'] },
        { title: 'Viernes Santo', date: '2026-04-03', allDay: true, classNames: ['holiday-event', 'holiday-viernes-santo'] },
        { title: 'Día del Trabajo', date: '2026-05-01', allDay: true, classNames: ['holiday-event', 'holiday-trabajo'] },
        { title: 'Corpus Christi', date: '2026-06-04', allDay: true, classNames: ['holiday-event', 'holiday-corpus'] },
        { title: 'Año Nuevo Aymara', date: '2026-06-22', allDay: true, classNames: ['holiday-event', 'holiday-aymara'] },
        { title: 'Día de la Independencia', date: '2026-08-06', allDay: true, classNames: ['holiday-event', 'holiday-independencia'] },
        { title: 'Día de Todos Santos', date: '2026-11-02', allDay: true, classNames: ['holiday-event', 'holiday-santos'] },
        { title: 'Navidad', date: '2026-12-25', allDay: true, classNames: ['holiday-event', 'holiday-navidad'] },
    ];

    // --- 3. LÓGICA PRINCIPAL ---
    async function initializeApp() {
        if (!calendarEl) {
            console.error("Calendar element #calendar not found.");
            return;
        }
        feather.replace(); 
        loadDarkModePreference();
        initializeCalendar();
        await fetchAndRenderEvents();
        listenForRealtimeChanges();
        setupEventListeners();
        updateTaskViewToggle();
    }

    initializeApp();

    // --- 4. MANEJO DE EVENTOS DE UI ---
    function setupEventListeners() {
        addEventBtn.addEventListener('click', () => openModalForNew());
        closeModalBtn.addEventListener('click', closeModal);
        xCloseModalBtn.addEventListener('click', closeModal);
        eventForm.addEventListener('submit', handleFormSubmit);
        
        deleteEventBtn.addEventListener('click', () => {
            const eventId = document.getElementById('eventId').value;
            if (eventId) showConfirmDeleteModal(eventId);
        });

        cancelDeleteBtn.addEventListener('click', hideConfirmDeleteModal);
        confirmDeleteBtn.addEventListener('click', async () => {
            const eventId = confirmModal.dataset.eventId;
            if (eventId) await deleteEvent(eventId);
        });
        
        addRecurringBtn.addEventListener('click', openRecurringModal);
        closeRecurringModalBtn.addEventListener('click', closeRecurringModal);
        xCloseRecurringModalBtn.addEventListener('click', closeRecurringModal);
        recurringEventForm.addEventListener('submit', handleRecurringFormSubmit);

        userNameSelect.addEventListener('change', () => {
            localStorage.setItem('calendarUserName', userNameSelect.value);
        });
        
        if (localStorage.getItem('calendarUserName')) {
            userNameSelect.value = localStorage.getItem('calendarUserName');
        }

        tasksToggle.addEventListener('click', (e) => {
            const view = e.target.dataset.view;
            if (view && view !== currentTaskView) {
                currentTaskView = view;
                updateTasksList(allEvents);
                updateTaskViewToggle();
            }
        });

        prioritySelect.addEventListener('change', (e) => updatePrioritySelectColor(e.target, e.target.value));
        document.getElementById('recurringPriority').addEventListener('change', (e) => updatePrioritySelectColor(e.target, e.target.value));

        darkModeToggle.addEventListener('click', toggleDarkMode);
    }

    // --- 5. FUNCIONES DE SUPABASE Y TIEMPO REAL ---
    async function fetchAndRenderEvents() {
        const { data, error } = await supabaseClient.from('events').select('*');
        if (error) {
            console.error('Error fetching events:', error);
            showNotification(`Error: ${error.message}`, true);
            return;
        }
        allEvents = data;
        
        if (userEventSource) userEventSource.remove();
        userEventSource = calendar.addEventSource(formatEventsForCalendar(allEvents));
        
        updateTasksList(allEvents);
        updateNotificationBell(allEvents);
    }

    function listenForRealtimeChanges() {
        supabaseClient.channel('public:events')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, payload => {
                fetchAndRenderEvents();
                showNotification('Calendario actualizado en tiempo real.');
            })
            .subscribe();
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const eventData = {
            user: userNameSelect.value,
            title: document.getElementById('eventTitle').value,
            start: new Date(document.getElementById('startDate').value).toISOString(),
            end: document.getElementById('endDate').value ? new Date(document.getElementById('endDate').value).toISOString() : null,
            priority: document.getElementById('priority').value,
            notes: document.getElementById('eventNotes').value,
        };
        const eventId = document.getElementById('eventId').value;

        if (!eventData.user || !eventData.title || !eventData.start) {
            showNotification('Por favor, completa los campos requeridos.', true);
            return;
        }

        const { error } = eventId
            ? await supabaseClient.from('events').update(eventData).eq('id', eventId)
            : await supabaseClient.from('events').insert([eventData]);

        if (error) {
            showNotification(`Error: ${error.message}`, true);
        } else {
            showNotification(`Evento ${eventId ? 'actualizado' : 'guardado'} con éxito.`);
            closeModal();
        }
    }
    
    async function handleRecurringFormSubmit(e) {
        e.preventDefault();
        
        const clientName = document.getElementById('recurringClientName').value;
        const dayOfMonth = parseInt(document.getElementById('recurringDay').value);
        const user = document.getElementById('recurringUserName').value;
        const priority = document.getElementById('recurringPriority').value;

        if (!clientName || !dayOfMonth || !user) {
            showNotification('Completa todos los campos para el cierre.', true);
            return;
        }

        const newEvents = [];
        const today = new Date();
        const monthsToGenerate = (dayOfMonth === 31) ? 6 : 12;

        for (let i = 0; i < monthsToGenerate; i++) {
            const currentMonthDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
            const year = currentMonthDate.getFullYear();
            const month = currentMonthDate.getMonth();

            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const targetDay = Math.min(dayOfMonth, daysInMonth);

            let eventDate = new Date(year, month, targetDay, 12, 0, 0);
            let dayOfWeek = eventDate.getDay(); 
            
            if (dayOfWeek === 6) { // Saturday
                eventDate.setDate(eventDate.getDate() - 1);
            } else if (dayOfWeek === 0) { // Sunday
                eventDate.setDate(eventDate.getDate() - 2);
            }
            
            newEvents.push({
                user: user,
                title: `Cierre - ${clientName}`,
                start: eventDate.toISOString(),
                priority: priority,
                notes: `Cierre mensual para el día ${dayOfMonth}.`
            });
        }

        const { error } = await supabaseClient.from('events').insert(newEvents);
        if (error) {
            showNotification(`Error al crear cierres: ${error.message}`, true);
        } else {
            showNotification(`Se generaron ${monthsToGenerate} cierres para ${clientName}.`, false);
            closeRecurringModal();
        }
    }

    async function deleteEvent(eventId) {
        if (!eventId) return;
        const { error } = await supabaseClient.from('events').delete().eq('id', eventId);
        hideConfirmDeleteModal();
        if (error) {
            showNotification(`Error al eliminar: ${error.message}`, true);
        } else {
            showNotification('Evento eliminado con éxito.');
            closeModal();
        }
    }
    
    // --- 6. FUNCIONES DE UI Y AUXILIARES ---
    function initializeCalendar() {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
            locale: 'es',
            buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana', list: 'Agenda' },
            eventSources: [{ events: holidays, editable: false }],
            eventClassNames: (arg) => {
                if(arg.event.extendedProps.user) {
                    const user = (arg.event.extendedProps.user || 'default').toLowerCase().replace(/\s+/g, '-');
                    const priority = (arg.event.extendedProps.priority || 'default').toLowerCase();
                    return [`event-${user}`, `event-${priority}`];
                }
                return [];
            },
            eventDidMount: (info) => {
                if(info.event.extendedProps.user) {
                    tippy(info.el, {
                        content: createTooltipContent(info.event),
                        allowHTML: true, theme: 'custom', placement: 'top', animation: 'shift-away',
                    });
                }
            },
            dateClick: (info) => openModalForNew(info.date),
            eventClick: (info) => {
                if(info.event.extendedProps.user) openModalForEdit(info.event)
            },
        });
        calendar.render();
    }

    function createTooltipContent(event) {
        const { user, priority, notes } = event.extendedProps;
        const start = new Date(event.start).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
        const end = event.end ? new Date(event.end).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
        return `<div class="tooltip-content"><div class="tooltip-title">${event.title}</div><div class="tooltip-body"><p><strong>Responsable:</strong> ${user}</p><p><strong>Prioridad:</strong> ${priority}</p><p><strong>Inicio:</strong> ${start}</p><p><strong>Fin:</strong> ${end}</p>${notes ? `<p><strong>Notas:</strong> ${notes}</p>` : ''}</div></div>`;
    }

    function formatEventsForCalendar(events) {
        return events.map(event => ({ id: event.id, title: event.title, start: event.start, end: event.end, extendedProps: { ...event } }));
    }

    function updateTasksList(events) {
        const currentUser = localStorage.getItem('calendarUserName');
        const now = new Date();
        const filteredEvents = currentTaskView === 'past'
            ? events.filter(e => new Date(e.start) < now).sort((a, b) => new Date(b.start) - new Date(a.start))
            : events.filter(e => new Date(e.start) >= now).sort((a, b) => new Date(a.start) - new Date(b.start));

        tasksList.innerHTML = '';
        if (filteredEvents.length === 0) {
            tasksList.innerHTML = `<p class="text-center text-slate-500 mt-4">No hay tareas ${currentTaskView === 'past' ? 'pasadas' : 'próximas'}.</p>`;
            return;
        }

        filteredEvents.forEach((event) => {
            const el = document.createElement('div');
            el.className = `relative flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all duration-200 border-l-4 ${event.user === currentUser ? 'bg-blue-50' : 'hover:bg-slate-50'} priority-border-${event.priority}`;
            el.onclick = () => { if(calendar.getEventById(event.id)) openModalForEdit(calendar.getEventById(event.id)); };
            el.innerHTML = `<div class="flex-grow overflow-hidden"><p class="font-bold text-slate-800 truncate">${event.title}</p><p class="text-sm text-slate-500">${new Date(event.start).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'})}</p><div class="flex items-center space-x-2 mt-1 text-xs"><span class="font-semibold text-slate-600">${event.user}</span>${event.notes ? `<i data-feather="file-text" class="h-4 w-4 text-slate-400" title="${event.notes}"></i>` : ''}</div></div>`;
            tasksList.appendChild(el);
        });
        feather.replace();
    }
    
    function updateNotificationBell(events) {
        const now = new Date();
        const endOfTomorrow = new Date();
        endOfTomorrow.setDate(now.getDate() + 1);
        endOfTomorrow.setHours(23, 59, 59, 999);
        const upcoming = events.filter(e => new Date(e.start) >= now && new Date(e.start) <= endOfTomorrow);
        notificationBadge.textContent = upcoming.length;
        notificationBadge.classList.toggle('hidden', upcoming.length === 0);
        tooltipList.innerHTML = upcoming.length > 0 ? upcoming.map(e => `<li class="truncate">• ${e.title} (${e.user})</li>`).join('') : '<li class="text-slate-400">Nada para hoy o mañana.</li>';
    }

    function showNotification(message, isError = false) {
        notification.className = `fixed top-0 left-1/2 -translate-x-1/2 text-white py-3 px-6 rounded-b-lg shadow-lg transition-transform duration-500 ${isError ? 'bg-red-500' : 'bg-green-500'}`;
        notificationText.textContent = message;
        notification.style.transform = 'translate(-50%, 0)';
        setTimeout(() => { notification.style.transform = 'translate(-50%, -110%)'; }, 3000);
    }

    function toLocalISOString(date) {
        if (!date) return '';
        const d = new Date(date);
        return isNaN(d.getTime()) ? '' : new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    }
    
    function updateTaskViewToggle() {
        document.querySelectorAll('#tasksToggle button').forEach(btn => {
            btn.classList.toggle('active-view', btn.dataset.view === currentTaskView);
        });
    }

    function updatePrioritySelectColor(el, priority) {
        el.classList.remove('priority-select-Pendiente', 'priority-select-Tentative', 'priority-select-Normal', 'priority-select-Urgent');
        if (priority) el.classList.add(`priority-select-${priority}`);
    }

    function openModalForNew(date) {
        eventForm.reset();
        modalTitle.textContent = 'Nuevo Evento';
        deleteEventBtn.classList.add('hidden');
        saveEventBtn.textContent = 'Guardar Evento';
        document.getElementById('eventId').value = '';
        document.getElementById('startDate').value = toLocalISOString(date || new Date());
        userNameSelect.value = localStorage.getItem('calendarUserName') || '';
        updatePrioritySelectColor(prioritySelect, 'Normal');
        prioritySelect.value = 'Normal';
        modal.classList.remove('hidden');
    }

    function openModalForEdit(event) {
        const { id, title, start, end, priority, user, notes } = event.extendedProps;
        eventForm.reset();
        modalTitle.textContent = 'Editar Evento';
        deleteEventBtn.classList.remove('hidden');
        saveEventBtn.textContent = 'Actualizar Evento';
        document.getElementById('eventId').value = id;
        document.getElementById('userName').value = user;
        document.getElementById('eventTitle').value = title;
        document.getElementById('startDate').value = toLocalISOString(new Date(start));
        document.getElementById('endDate').value = toLocalISOString(end ? new Date(end) : null);
        document.getElementById('priority').value = priority;
        document.getElementById('eventNotes').value = notes || '';
        updatePrioritySelectColor(prioritySelect, priority);
        modal.classList.remove('hidden');
    }

    function closeModal() {
        modal.classList.add('hidden');
    }

    function showConfirmDeleteModal(eventId) {
        confirmModal.dataset.eventId = eventId;
        confirmModal.classList.remove('hidden');
    }

    function hideConfirmDeleteModal() {
        confirmModal.classList.add('hidden');
        delete confirmModal.dataset.eventId;
    }

    function openRecurringModal() {
        recurringEventForm.reset();
        document.getElementById('recurringUserName').value = localStorage.getItem('calendarUserName') || '';
        updatePrioritySelectColor(document.getElementById('recurringPriority'), 'Normal');
        document.getElementById('recurringPriority').value = 'Normal';
        recurringModal.classList.remove('hidden');
    }

    function closeRecurringModal() {
        recurringModal.classList.add('hidden');
    }

    function toggleDarkMode() {
        const html = document.documentElement;
        html.classList.toggle('dark');
        
        if (html.classList.contains('dark')) {
            localStorage.setItem('darkMode', 'enabled');
            darkModeToggle.innerHTML = `<i data-feather="sun" class="text-slate-300"></i>`;
        } else {
            localStorage.removeItem('darkMode');
            darkModeToggle.innerHTML = `<i data-feather="moon" class="text-slate-600"></i>`;
        }
        feather.replace();
    }

    function loadDarkModePreference() {
        if (localStorage.getItem('darkMode') === 'enabled') {
            document.documentElement.classList.add('dark');
            darkModeToggle.innerHTML = `<i data-feather="sun" class="text-slate-300"></i>`;
        } else {
            darkModeToggle.innerHTML = `<i data-feather="moon" class="text-slate-600"></i>`;
        }
        feather.replace();
    }
});


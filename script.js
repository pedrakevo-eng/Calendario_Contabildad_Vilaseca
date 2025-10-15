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

    // --- 3. LÓGICA PRINCIPAL ---
    async function initializeApp() {
        if (!calendarEl) {
            console.error("Calendar element #calendar not found.");
            alert("Error: El elemento del calendario no se encuentra en la página.");
            return;
        }
        feather.replace(); 
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
        
        // Listeners para eventos recurrentes
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
            if (view) {
                currentTaskView = view;
                updateTasksList(allEvents);
                updateTaskViewToggle();
            }
        });

        prioritySelect.addEventListener('change', (e) => updatePrioritySelectColor(e.target, e.target.value));
        document.getElementById('recurringPriority').addEventListener('change', (e) => updatePrioritySelectColor(e.target, e.target.value));

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
        calendar.removeAllEvents();
        calendar.addEventSource(formatEventsForCalendar(allEvents));
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

        let error;
        if (eventId) {
            ({ error } = await supabaseClient.from('events').update(eventData).eq('id', eventId));
        } else {
            ({ error } = await supabaseClient.from('events').insert([eventData]));
        }

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
        
        // Generar eventos para los próximos 12 meses
        for (let i = 0; i < 12; i++) {
            let targetDate = new Date(today.getFullYear(), today.getMonth() + i, dayOfMonth, 12, 0, 0); // Fijar hora a mediodía para evitar problemas de zona horaria

            let dayOfWeek = targetDate.getDay();
            
            // Si es Sábado (6), retrocede 1 día al Viernes.
            if (dayOfWeek === 6) {
                targetDate.setDate(targetDate.getDate() - 1);
            } 
            // Si es Domingo (0), retrocede 2 días al Viernes.
            else if (dayOfWeek === 0) {
                targetDate.setDate(targetDate.getDate() - 2);
            }

            const eventData = {
                user: user,
                title: `Cierre - ${clientName}`,
                start: targetDate.toISOString(),
                priority: priority,
                notes: `Cierre mensual automático para el día ${dayOfMonth}.`
            };
            newEvents.push(eventData);
        }

        const { error } = await supabaseClient.from('events').insert(newEvents);

        if (error) {
            showNotification(`Error al crear cierres: ${error.message}`, true);
        } else {
            showNotification(`Se generaron 12 eventos de cierre para ${clientName}.`, false);
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
            eventClassNames: (arg) => {
                const user = (arg.event.extendedProps.user || 'default').toLowerCase().replace(/\s+/g, '-');
                const priority = (arg.event.extendedProps.priority || 'default').toLowerCase();
                return [`event-${user}`, `event-${priority}`];
            },
            eventDidMount: (info) => {
                tippy(info.el, {
                    content: createTooltipContent(info.event),
                    allowHTML: true, theme: 'custom', placement: 'top', animation: 'shift-away',
                });
            },
            dateClick: (info) => openModalForNew(info.date),
            eventClick: (info) => openModalForEdit(info.event),
        });
        calendar.render();
    }

    function createTooltipContent(event) {
        const props = event.extendedProps;
        const startDate = new Date(event.start).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
        const endDate = event.end ? new Date(event.end).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
        return `<div class="tooltip-content"><div class="tooltip-title">${props.title}</div><div class="tooltip-body"><p><strong>Responsable:</strong> ${props.user}</p><p><strong>Prioridad:</strong> ${props.priority}</p><p><strong>Inicio:</strong> ${startDate}</p><p><strong>Fin:</strong> ${endDate}</p>${props.notes ? `<p><strong>Notas:</strong> ${props.notes}</p>` : ''}</div></div>`;
    }

    function formatEventsForCalendar(events) {
        return events.map(event => ({ id: event.id, title: event.title, start: event.start, end: event.end, extendedProps: { ...event } }));
    }

    function updateTasksList(events) {
        const currentUser = localStorage.getItem('calendarUserName');
        const now = new Date();
        const filteredEvents = events.filter(event => new Date(event.start) >= now).sort((a, b) => new Date(a.start) - new Date(b.start));
        tasksList.innerHTML = '';
        if (filteredEvents.length === 0) {
            tasksList.innerHTML = `<p class="text-center text-slate-500 mt-4">No hay tareas próximas.</p>`;
            return;
        }
        filteredEvents.forEach((event) => {
            const eventEl = document.createElement('div');
            eventEl.className = `relative flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all duration-200 border-l-4 ${event.user === currentUser ? 'bg-blue-50' : 'hover:bg-slate-50'} priority-border-${event.priority}`;
            eventEl.onclick = () => { if(calendar.getEventById(event.id)) openModalForEdit(calendar.getEventById(event.id)); };
            eventEl.innerHTML = `<div class="flex-grow overflow-hidden"><p class="font-bold text-slate-800 truncate">${event.title}</p><p class="text-sm text-slate-500">${new Date(event.start).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'})}</p><div class="flex items-center space-x-2 mt-1 text-xs"><span class="font-semibold text-slate-600">${event.user}</span>${event.notes ? `<i data-feather="file-text" class="h-4 w-4 text-slate-400" title="${event.notes}"></i>` : ''}</div></div>`;
            tasksList.appendChild(eventEl);
        });
        feather.replace();
    }
    
    function updateNotificationBell(events) {
        const now = new Date();
        const endOfTomorrow = new Date();
        endOfTomorrow.setDate(now.getDate() + 1);
        endOfTomorrow.setHours(23, 59, 59, 999);
        const upcomingEvents = events.filter(event => new Date(event.start) >= now && new Date(event.start) <= endOfTomorrow);
        notificationBadge.textContent = upcomingEvents.length;
        notificationBadge.classList.toggle('hidden', upcomingEvents.length === 0);
        tooltipList.innerHTML = upcomingEvents.length > 0 ? upcomingEvents.map(e => `<li class="truncate">• ${e.title} (${e.user})</li>`).join('') : '<li class="text-slate-400">Nada para hoy o mañana.</li>';
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
        if (isNaN(d.getTime())) return '';
        return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    }
    
    function updateTaskViewToggle() {
        document.querySelectorAll('#tasksToggle button').forEach(btn => btn.classList.toggle('active-view', btn.dataset.view === currentTaskView));
    }

    function updatePrioritySelectColor(selectElement, priority) {
        const classes = ['priority-select-Pendiente', 'priority-select-Tentative', 'priority-select-Normal', 'priority-select-Urgent'];
        selectElement.classList.remove(...classes);
        if (priority) selectElement.classList.add(`priority-select-${priority}`);
    }

    function openModalForNew(date) {
        eventForm.reset();
        modalTitle.textContent = 'Nuevo Evento';
        deleteEventBtn.classList.add('hidden');
        saveEventBtn.textContent = 'Guardar Evento';
        document.getElementById('eventId').value = '';
        document.getElementById('startDate').value = toLocalISOString(date || new Date());
        userNameSelect.value = localStorage.getItem('calendarUserName') || '';
        prioritySelect.value = 'Normal';
        updatePrioritySelectColor(prioritySelect, 'Normal');
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
        document.getElementById('endDate').value = end ? toLocalISOString(new Date(end)) : '';
        prioritySelect.value = priority;
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
        document.getElementById('recurringPriority').value = 'Normal';
        updatePrioritySelectColor(document.getElementById('recurringPriority'), 'Normal');
        recurringModal.classList.remove('hidden');
    }

    function closeRecurringModal() {
        recurringModal.classList.add('hidden');
    }
});


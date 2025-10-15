document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURACIÓN DE SUPABASE ---
    // ¡IMPORTANTE! Reemplaza estos valores con tu propia URL y llave de Supabase.
    const SUPABASE_URL = 'https://xzzxodtbgnlsupkcncjb.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6enhvZHRiZ25sc3Vwa2NuY2piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0OTIyMjMsImV4cCI6MjA3NjA2ODIyM30.CnYV46EaxYbLOJ4EcQeYkvzDEecbD_BelymgV1HVicU';

    // Corrección: Inicializar el cliente de Supabase correctamente.
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

    let calendar; // Variable para la instancia de FullCalendar.
    let allEvents = []; // Almacenamos los eventos en caché para un renderizado rápido.

    // --- 3. LÓGICA PRINCIPAL ---
    async function initializeApp() {
        initializeCalendar();
        await fetchAndRenderEvents();
        listenForRealtimeChanges();
        setupEventListeners();
    }

    initializeApp();

    // --- 4. MANEJO DE EVENTOS DE UI ---
    function setupEventListeners() {
        addEventBtn.addEventListener('click', () => openModalForNew());
        closeModalBtn.addEventListener('click', closeModal);
        xCloseModalBtn.addEventListener('click', closeModal);
        eventForm.addEventListener('submit', handleFormSubmit);
        userNameSelect.addEventListener('change', () => {
            localStorage.setItem('calendarUserName', userNameSelect.value)
            updateTasksList(allEvents); // Re-render task list on user change to apply highlighting
        });
        
        // Cargar el último usuario seleccionado.
        if (localStorage.getItem('calendarUserName')) {
            userNameSelect.value = localStorage.getItem('calendarUserName');
        }
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
        const formattedEvents = formatEventsForCalendar(allEvents);
        calendar.getEventSources().forEach(source => source.remove());
        calendar.addEventSource(formattedEvents);
        updateTasksList(allEvents);
        updateNotificationBell(allEvents);
    }

    function listenForRealtimeChanges() {
        supabaseClient.channel('public:events')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, payload => {
                console.log('Realtime change received!', payload);
                fetchAndRenderEvents(); // Vuelve a cargar todo para reflejar el cambio.
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
        };
        const eventId = document.getElementById('eventId').value;

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

    function handleDeleteConfirmation() {
        deleteEventBtn.textContent = '¿Seguro? Clic para confirmar';
        deleteEventBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
        deleteEventBtn.classList.add('bg-yellow-400', 'hover:bg-yellow-500', 'text-black');
        
        deleteEventBtn.onclick = async () => {
            const eventId = document.getElementById('eventId').value;
            if (!eventId) return;

            const { error } = await supabaseClient.from('events').delete().eq('id', eventId);
            if (error) {
                showNotification(`Error al eliminar: ${error.message}`, true);
            } else {
                showNotification('Evento eliminado.');
                closeModal();
            }
        };
    }
    
    function resetDeleteButtonState() {
        deleteEventBtn.textContent = 'Eliminar';
        deleteEventBtn.classList.remove('bg-yellow-400', 'hover:bg-yellow-500', 'text-black');
        deleteEventBtn.classList.add('bg-red-500', 'hover:bg-red-600');
        deleteEventBtn.onclick = handleDeleteConfirmation;
    }

    // --- 6. FUNCIONES DE UI Y AUXILIARES ---
    function initializeCalendar() {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
            locale: 'es',
            buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana', list: 'Agenda' },
            eventClassNames: (arg) => {
                const user = arg.event.extendedProps.user?.toLowerCase() || 'default';
                const priority = arg.event.extendedProps.priority?.toLowerCase() || 'normal';
                return [`event-${user}`, `event-${priority}`];
            },
            dateClick: (info) => openModalForNew(info.date),
            eventClick: (info) => openModalForEdit(info.event),
        });
        calendar.render();
    }

    function formatEventsForCalendar(events) {
        return events.map(event => {
            let titlePrefix = '';
            if (event.priority === 'Urgent') titlePrefix = '❗ ';
            else if (event.priority === 'Pendiente') titlePrefix = '⏳ ';

            return {
                id: event.id,
                title: `${titlePrefix}${event.title}`,
                start: event.start,
                end: event.end,
                extendedProps: { ...event }
            };
        });
    }

    function updateTasksList(events) {
        const currentUser = localStorage.getItem('calendarUserName');
        const now = new Date();
        const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        
        // Se quita el filtro para mostrar todas las tareas, pasadas y futuras
        const sortedEvents = [...events]
            .sort((a, b) => new Date(a.start) - new Date(b.start));

        tasksList.innerHTML = '';
        
        if (sortedEvents.length === 0) {
            tasksList.innerHTML = `<p class="text-center text-slate-500 mt-4">No hay tareas registradas.</p>`;
            return;
        }

        sortedEvents.forEach((event, index) => {
            const eventEl = document.createElement('div');
            const eventDate = new Date(event.start);
            const isPast = eventDate < now; // Verificamos si la tarea ya pasó
            const isSoon = !isPast && eventDate <= twentyFourHoursFromNow;
            const isCurrentUserTask = event.user === currentUser;
            
            // Aplicamos estilos diferentes para tareas pasadas
            const pastTaskClasses = isPast ? 'opacity-60' : 'hover:bg-slate-50';
            const titleClasses = isPast ? 'line-through' : '';

            eventEl.className = `flex items-center space-x-3 p-3 rounded-lg cursor-pointer ${pastTaskClasses} ${isCurrentUserTask ? 'user-task bg-blue-50' : ''}`;
            eventEl.onclick = () => {
                const calEvent = calendar.getEventById(event.id);
                if(calEvent) openModalForEdit(calEvent);
            };

            let priorityIcon = '';
            if (event.priority === 'Urgent') priorityIcon = `<i data-feather="alert-triangle" class="text-red-500 h-4 w-4"></i>`;
            else if (event.priority === 'Tentative') priorityIcon = `<i data-feather="clock" class="text-yellow-500 h-4 w-4"></i>`;
            else if (event.priority === 'Pendiente') priorityIcon = `<i data-feather="pause-circle" class="text-purple-500 h-4 w-4"></i>`;
            
            eventEl.innerHTML = `
                <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center ${isPast ? 'bg-slate-100 text-slate-400' : 'bg-blue-100 text-blue-700'} font-bold rounded-full">${index + 1}</div>
                <div class="flex-grow overflow-hidden">
                    <div class="flex items-center space-x-2">
                       ${isSoon ? '<div class="glowing-dot w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>' : ''}
                       <p class="font-bold text-slate-800 truncate ${titleClasses}">${event.title}</p>
                    </div>
                    <p class="text-sm text-slate-500">${eventDate.toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'})}</p>
                    <div class="flex items-center space-x-2 mt-1 text-xs">
                        <span class="font-semibold text-slate-600">${event.user}</span>
                        ${priorityIcon ? `<div class="flex items-center space-x-1">${priorityIcon}<span class="text-slate-600">${event.priority}</span></div>` : ''}
                    </div>
                </div>`;
            tasksList.appendChild(eventEl);
        });
        feather.replace();
    }

    function updateNotificationBell(events) {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const startOfTomorrow = new Date(tomorrow.setHours(0, 0, 0, 0));
        const endOfTomorrow = new Date(tomorrow.setHours(23, 59, 59, 999));

        const tomorrowsEvents = events.filter(event => {
            const eventDate = new Date(event.start);
            return eventDate >= startOfTomorrow && eventDate <= endOfTomorrow;
        });
        
        notificationBadge.textContent = tomorrowsEvents.length;
        notificationBadge.classList.toggle('hidden', tomorrowsEvents.length === 0);
        
        tooltipList.innerHTML = tomorrowsEvents.length > 0 
            ? tomorrowsEvents.map(e => `<li class="truncate">• ${e.title}</li>`).join('')
            : '<li class="text-slate-400">Nada para mañana.</li>';
    }

    function showNotification(message, isError = false) {
        notification.className = `fixed top-0 left-1/2 -translate-x-1/2 -translate-y-full text-white py-3 px-6 rounded-b-lg shadow-lg ${isError ? 'bg-red-500' : 'bg-green-500'}`;
        notificationText.textContent = message;
        notification.style.transform = 'translate(-50%, 0)';
        setTimeout(() => {
            notification.style.transform = 'translate(-50%, -100%)';
        }, 3000);
    }

    function toLocalISOString(date) {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        const offset = d.getTimezoneOffset();
        const localDate = new Date(d.getTime() - (offset * 60000));
        return localDate.toISOString().slice(0, 16);
    }

    function openModalForNew(date) {
        eventForm.reset();
        modalTitle.textContent = 'Nuevo Evento';
        document.getElementById('eventId').value = '';
        deleteEventBtn.classList.add('hidden');
        saveEventBtn.textContent = 'Guardar Evento';
        document.getElementById('startDate').value = toLocalISOString(date || new Date());
        userNameSelect.value = localStorage.getItem('calendarUserName') || '';
        modal.classList.remove('hidden');
        resetDeleteButtonState();
    }

    function openModalForEdit(event) {
        const { id, title, start, end, priority, user } = event.extendedProps;
        eventForm.reset();
        modalTitle.textContent = 'Editar Evento';
        document.getElementById('eventId').value = id;
        document.getElementById('userName').value = user;
        document.getElementById('eventTitle').value = title.replace('❗ ', '').replace('⏳ ', '');
        document.getElementById('startDate').value = toLocalISOString(new Date(start));
        document.getElementById('endDate').value = end ? toLocalISOString(new Date(end)) : '';
        document.getElementById('priority').value = priority;
        deleteEventBtn.classList.remove('hidden');
        saveEventBtn.textContent = 'Actualizar Evento';
        modal.classList.remove('hidden');
        resetDeleteButtonState();
    }

    function closeModal() {
        modal.classList.add('hidden');
    }
});
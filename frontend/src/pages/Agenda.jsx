import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../services/api.js';
import AppointmentModal from '../components/AppointmentModal.jsx';
import {
  addDays,
  addMonths,
  endOfMonth,
  formatLong,
  formatMonthYear,
  hourSlots,
  monthGrid,
  startOfMonth,
  timeToMinutes,
  todayKey,
  weekDays,
  weekLabel,
  WEEKDAYS_SHORT,
} from '../lib/date.js';
import { statusLabel } from '../lib/status.js';
import './agenda.css';

const VIEWS = [
  { key: 'day', label: 'Dia' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
];

const HOUR_HEIGHT = 60; // pixels por hora cheia

export default function Agenda() {
  const { settings } = useAuth();
  const [view, setView] = useState('week');
  const [cursor, setCursor] = useState(todayKey());
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { appointment? , date?, time? } | null
  const [errorMsg, setErrorMsg] = useState('');

  const workStart = settings?.workStart ?? '08:00';
  const workEnd = settings?.workEnd ?? '18:00';
  const defaultDuration = settings?.defaultDuration ?? 50;

  const range = useMemo(() => {
    if (view === 'day') return { from: cursor, to: cursor };
    if (view === 'week') {
      const days = weekDays(cursor);
      return { from: days[0], to: days[6] };
    }
    return { from: startOfMonth(cursor), to: endOfMonth(cursor) };
  }, [view, cursor]);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await api.listAppointments(range);
      setAppointments(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  const loadSummary = useCallback(async () => {
    const today = todayKey();
    const days = weekDays(today);
    try {
      const data = await api.summary({ today, weekStart: days[0], weekEnd: days[6] });
      setSummary(data);
    } catch {
      // o resumo e apenas informativo, nao trava a tela em caso de falha
    }
  }, []);

  useEffect(() => {
    api.listClients().then(setClients).catch(() => setClients([]));
  }, []);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, appointments]);

  function goToday() {
    setCursor(todayKey());
  }

  function goPrev() {
    if (view === 'day') setCursor((c) => addDays(c, -1));
    else if (view === 'week') setCursor((c) => addDays(c, -7));
    else setCursor((c) => addMonths(c, -1));
  }

  function goNext() {
    if (view === 'day') setCursor((c) => addDays(c, 1));
    else if (view === 'week') setCursor((c) => addDays(c, 7));
    else setCursor((c) => addMonths(c, 1));
  }

  function openCreate(date, time) {
    setModal({ initial: { date, startTime: time } });
  }

  function openEdit(appointment) {
    setModal({ appointment });
  }

  function handleSaved() {
    setModal(null);
    loadAppointments();
  }

  function handleDeleted() {
    setModal(null);
    loadAppointments();
  }

  const title = useMemo(() => {
    if (view === 'day') return formatLong(cursor);
    if (view === 'week') return weekLabel(cursor);
    return formatMonthYear(cursor);
  }, [view, cursor]);

  return (
    <div className="agenda">
      <header className="agenda-header">
        <div className="agenda-title-row">
          <h1>Minha Agenda</h1>
          <button
            className="btn btn-primary new-btn"
            type="button"
            onClick={() => openCreate(view === 'month' ? todayKey() : cursor, '')}
          >
            + Novo agendamento
          </button>
        </div>

        <div className="agenda-toolbar">
          <div className="agenda-nav">
            <button className="btn" type="button" onClick={goToday}>
              Hoje
            </button>
            <button className="btn icon-btn" type="button" onClick={goPrev} aria-label="Anterior">
              ‹
            </button>
            <button className="btn icon-btn" type="button" onClick={goNext} aria-label="Próximo">
              ›
            </button>
            <span className="agenda-period">{title}</span>
          </div>

          <div className="view-switch">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                className={`view-btn ${view === v.key ? 'active' : ''}`}
                onClick={() => setView(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <SummaryBar summary={summary} />
      </header>

      {errorMsg && <p className="error-text">{errorMsg}</p>}

      {view === 'month' ? (
        <MonthView
          cursor={cursor}
          appointments={appointments}
          onPickDay={(day) => {
            setCursor(day);
            setView('day');
          }}
          onOpenAppointment={openEdit}
        />
      ) : (
        <GridView
          days={view === 'day' ? [cursor] : weekDays(cursor)}
          workStart={workStart}
          workEnd={workEnd}
          appointments={appointments}
          loading={loading}
          onSlotClick={openCreate}
          onAppointmentClick={openEdit}
        />
      )}

      {modal && (
        <AppointmentModal
          appointment={modal.appointment}
          initial={modal.initial}
          clients={clients}
          defaultDuration={defaultDuration}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}

function SummaryBar({ summary }) {
  if (!summary) return null;
  return (
    <div className="summary-bar">
      <div className="summary-item">
        <span className="summary-value">{summary.todayCount}</span>
        <span className="summary-label">hoje</span>
      </div>
      <div className="summary-divider" />
      <div className="summary-item">
        <span className="summary-value">
          {summary.next ? `${summary.next.startTime} — ${summary.next.client?.name ?? ''}` : '—'}
        </span>
        <span className="summary-label">próximo</span>
      </div>
      <div className="summary-divider" />
      <div className="summary-item">
        <span className="summary-value">{summary.weekCount}</span>
        <span className="summary-label">esta semana</span>
      </div>
    </div>
  );
}

function GridView({ days, workStart, workEnd, appointments, loading, onSlotClick, onAppointmentClick }) {
  const slots = hourSlots(workStart, workEnd);
  const gridStart = timeToMinutes(slots[0]);
  const gridEnd = timeToMinutes(workEnd);
  const totalHeight = ((gridEnd - gridStart) / 60) * HOUR_HEIGHT;
  const isDay = days.length === 1;
  const today = todayKey();

  const byDay = useMemo(() => {
    const map = new Map();
    for (const day of days) map.set(day, []);
    for (const appt of appointments) {
      if (map.has(appt.date)) map.get(appt.date).push(appt);
    }
    return map;
  }, [days, appointments]);

  return (
    <div className={`grid-view ${isDay ? 'grid-view-day' : ''}`}>
      <div className="grid-scroll">
        <div className="grid-head">
          <div className="grid-gutter" />
          {days.map((day) => (
            <div key={day} className={`grid-day-head ${day === today ? 'is-today' : ''}`}>
              <span className="grid-day-name">
                {isDay ? formatLong(day) : WEEKDAYS_SHORT[new Date(`${day}T00:00:00`).getDay()]}
              </span>
              {!isDay && <span className="grid-day-num">{day.slice(8, 10)}</span>}
            </div>
          ))}
        </div>

        <div className="grid-body" style={{ height: totalHeight }}>
          <div className="grid-gutter">
            {slots.map((slot) => (
              <div key={slot} className="grid-hour-label" style={{ height: HOUR_HEIGHT }}>
                {slot}
              </div>
            ))}
          </div>

          {days.map((day) => (
            <div key={day} className={`grid-day-col ${day === today ? 'is-today' : ''}`}>
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className="grid-slot"
                  style={{ height: HOUR_HEIGHT }}
                  onClick={() => onSlotClick(day, slot)}
                  aria-label={`Novo agendamento em ${day} as ${slot}`}
                />
              ))}

              {(byDay.get(day) ?? []).map((appt) => {
                const top = ((timeToMinutes(appt.startTime) - gridStart) / 60) * HOUR_HEIGHT;
                const height = Math.max(
                  22,
                  ((timeToMinutes(appt.endTime) - timeToMinutes(appt.startTime)) / 60) * HOUR_HEIGHT - 2,
                );
                return (
                  <button
                    key={appt.id}
                    type="button"
                    className={`appt-block st-${appt.status}`}
                    style={{ top, height }}
                    onClick={() => onAppointmentClick(appt)}
                  >
                    <span className="appt-time">{appt.startTime}</span>
                    <span className="appt-name">{appt.client?.name}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {!loading && appointments.length === 0 && (
        <p className="empty small">Nenhum atendimento neste período. Clique em um horário para agendar.</p>
      )}
    </div>
  );
}

function MonthView({ cursor, appointments, onPickDay, onOpenAppointment }) {
  const days = monthGrid(cursor);
  const currentMonth = cursor.slice(0, 7);
  const today = todayKey();

  const byDay = useMemo(() => {
    const map = new Map();
    for (const appt of appointments) {
      if (!map.has(appt.date)) map.set(appt.date, []);
      map.get(appt.date).push(appt);
    }
    return map;
  }, [appointments]);

  return (
    <div className="month-view">
      <div className="month-weekdays">
        {WEEKDAYS_SHORT.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="month-grid">
        {days.map((day) => {
          const items = (byDay.get(day) ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
          const inMonth = day.slice(0, 7) === currentMonth;
          return (
            <div
              key={day}
              className={`month-cell ${inMonth ? '' : 'is-outside'} ${day === today ? 'is-today' : ''} ${items.length > 0 ? 'has-items' : ''}`}
              onClick={() => onPickDay(day)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onPickDay(day)}
            >
              <span className="month-day-num">{day.slice(8, 10)}</span>
              <div className="month-chips">
                {items.slice(0, 3).map((appt) => (
                  <span
                    key={appt.id}
                    className={`month-chip st-${appt.status}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenAppointment(appt);
                    }}
                    title={`${appt.startTime} ${appt.client?.name ?? ''} — ${statusLabel(appt.status)}`}
                  >
                    {appt.startTime} {appt.client?.name}
                  </span>
                ))}
                {items.length > 3 && <span className="month-more">+{items.length - 3}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

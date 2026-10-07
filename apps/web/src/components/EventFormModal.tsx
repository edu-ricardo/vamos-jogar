import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from './Modal';
import type {
  EventDateOption,
  EventLocationOption,
  FavoriteLocation,
} from '../services/eventService';
import './EventFormModal.scss';

export type EventLocationInput = EventLocationOption & { saveFavorite: boolean };

export interface EventFormValues {
  title: string;
  dates: EventDateOption[];
  // Só os locais marcados com saveFavorite devem ir para os favoritos
  locations: EventLocationInput[];
}

interface EventFormModalProps {
  heading: string;
  submitLabel: string;
  initial?: { title: string; dates: EventDateOption[]; locations: EventLocationOption[] };
  favorites: FavoriteLocation[];
  onSubmit: (values: EventFormValues) => Promise<void>;
  onClose: () => void;
}

const newId = () => Date.now().toString();
const emptyDate = (): EventDateOption => ({ id: newId(), date: '', startTime: '', endTime: '' });
const emptyLocation = (): EventLocationInput => ({
  id: newId(),
  name: '',
  address: '',
  saveFavorite: false,
});

// Criação e edição de evento: título, opções de data/horário e opções de local
export const EventFormModal = ({
  heading,
  submitLabel,
  initial,
  favorites,
  onSubmit,
  onClose,
}: EventFormModalProps) => {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [dates, setDates] = useState<EventDateOption[]>(
    initial?.dates.length ? initial.dates : [emptyDate()],
  );
  const [locations, setLocations] = useState<EventLocationInput[]>(
    initial?.locations.length
      ? initial.locations.map((l) => ({ ...l, saveFavorite: false }))
      : [emptyLocation()],
  );
  const [saving, setSaving] = useState(false);

  const updateDate = (index: number, changes: Partial<EventDateOption>) =>
    setDates(dates.map((d, i) => (i === index ? { ...d, ...changes } : d)));
  const updateLocation = (index: number, changes: Partial<EventLocationInput>) =>
    setLocations(locations.map((l, i) => (i === index ? { ...l, ...changes } : l)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validDates = dates.filter((d) => d.date && d.startTime);
    const validLocations = locations.filter((l) => l.name.trim() && l.address.trim());
    if (!title.trim() || validDates.length === 0 || validLocations.length === 0) {
      toast.error('Preencha corretamente pelo menos uma data e um local.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ title, dates: validDates, locations: validLocations });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={heading}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" form="event-form" className="btn-primary" disabled={saving}>
            {saving ? 'Salvando...' : submitLabel}
          </button>
        </>
      }
    >
      <form id="event-form" onSubmit={handleSubmit} className="event-form">
        <div className="field">
          <label htmlFor="event-title">Título do evento</label>
          <input
            id="event-title"
            required
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Sessão de Inverno"
          />
        </div>

        <fieldset className="event-form-group">
          <legend>Opções de data e horário</legend>
          {dates.map((item, idx) => (
            <div key={item.id} className="event-form-date">
              <input
                required={idx === 0}
                type="date"
                aria-label="Data"
                value={item.date}
                onChange={(e) => updateDate(idx, { date: e.target.value })}
              />
              <input
                required={idx === 0}
                type="time"
                aria-label="Início"
                value={item.startTime}
                onChange={(e) => updateDate(idx, { startTime: e.target.value })}
              />
              <span className="muted">até</span>
              <input
                type="time"
                aria-label="Fim (opcional)"
                value={item.endTime || ''}
                onChange={(e) => updateDate(idx, { endTime: e.target.value })}
              />
            </div>
          ))}
          <button
            type="button"
            className="btn-link"
            onClick={() => setDates([...dates, emptyDate()])}
          >
            + Adicionar outra data
          </button>
        </fieldset>

        <fieldset className="event-form-group">
          <legend>Opções de local</legend>
          {locations.map((item, idx) => (
            <div key={item.id} className="event-form-location">
              {favorites.length > 0 && (
                <div className="event-form-favorites">
                  {favorites.map((f) => (
                    <button
                      type="button"
                      key={f.id}
                      className="chip"
                      onClick={() => updateLocation(idx, { name: f.name, address: f.address })}
                    >
                      ⭐ {f.name}
                    </button>
                  ))}
                </div>
              )}
              <input
                required={idx === 0}
                type="text"
                value={item.name}
                onChange={(e) => updateLocation(idx, { name: e.target.value })}
                aria-label="Nome do local"
                placeholder="Nome (Ex: Casa do Edu)"
              />
              <input
                required={idx === 0}
                type="text"
                value={item.address}
                onChange={(e) => updateLocation(idx, { address: e.target.value })}
                aria-label="Endereço do local"
                placeholder="Endereço completo (para o Waze/Maps)"
              />
              <label className="event-form-check">
                <input
                  type="checkbox"
                  checked={item.saveFavorite}
                  onChange={(e) => updateLocation(idx, { saveFavorite: e.target.checked })}
                />
                Salvar este local nos meus favoritos
              </label>
            </div>
          ))}
          <button
            type="button"
            className="btn-link"
            onClick={() => setLocations([...locations, emptyLocation()])}
          >
            + Adicionar outro local
          </button>
        </fieldset>
      </form>
    </Modal>
  );
};

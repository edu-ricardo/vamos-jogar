import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { eventService, type Event, type EventDateOption, type EventLocationOption, type FavoriteLocation } from '../services/eventService';
import toast from 'react-hot-toast';

export const GroupDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  
  const [dateInputs, setDateInputs] = useState<EventDateOption[]>([
    { id: '1', date: '', startTime: '', endTime: '' }
  ]);
  
  const [locationInputs, setLocationInputs] = useState<(EventLocationOption & { saveFavorite: boolean })[]>([
    { id: '1', name: '', address: '', saveFavorite: false }
  ]);

  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);

  const loadEvents = async () => {
    if (!id) return;
    try {
      const fetched = await eventService.fetchGroupEvents(id);
      setEvents(fetched);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async () => {
    if (!user) return;
    const favs = await eventService.fetchFavoriteLocations(user.uid);
    setFavorites(favs);
  };

  useEffect(() => {
    loadEvents();
    loadFavorites();
  }, [id, user]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !title.trim() || !user) return;

    const validDates = dateInputs.filter(d => d.date && d.startTime);
    const validLocations = locationInputs.filter(l => l.name.trim() !== '' && l.address.trim() !== '');

    if (validDates.length === 0 || validLocations.length === 0) {
      toast.error('Preencha corretamente pelo menos uma data e um local.');
      return;
    }

    try {
      // Salvar favoritos selecionados
      for (const loc of validLocations) {
        if (loc.saveFavorite) {
          await eventService.saveFavoriteLocation(user.uid, { name: loc.name, address: loc.address });
        }
      }

      await eventService.createEvent(
        id,
        user.uid, 
        title, 
        validDates, 
        validLocations.map(({ id, name, address }) => ({ id, name, address }))
      );
      
      toast.success('Evento criado e pronto para votação!');
      setShowModal(false);
      setTitle('');
      setDateInputs([{ id: Date.now().toString(), date: '', startTime: '', endTime: '' }]);
      setLocationInputs([{ id: Date.now().toString(), name: '', address: '', saveFavorite: false }]);
      loadEvents();
      loadFavorites(); // Recarregar favoritos recém salvos
    } catch (err) {
      toast.error('Erro ao criar evento.');
    }
  };

  const applyFavorite = (fav: FavoriteLocation, index: number) => {
    const newInputs = [...locationInputs];
    newInputs[index].name = fav.name;
    newInputs[index].address = fav.address;
    setLocationInputs(newInputs);
    toast.success('Local carregado dos favoritos!');
  };

  return (
    <div style={{ padding: '20px 0' }}>
      <button onClick={() => navigate('/grupos')} style={{ background: 'transparent', color: '#a1a1aa', border: 'none', cursor: 'pointer', marginBottom: '20px', padding: 0 }}>
        &larr; Voltar a Grupos
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Detalhes do Grupo</h1>
        <button style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #71717a', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>
          ver membros
        </button>
      </div>

      <button 
        onClick={() => setShowModal(true)} 
        className="btn-primary"
        style={{ width: '100%', padding: '15px', fontSize: '1.1rem', background: 'transparent', border: '1px solid #fff', borderRadius: '12px', marginBottom: '30px' }}
      >
        + Criar Evento
      </button>

      <section>
        {loading ? <p>Carregando eventos...</p> : events.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>Nenhum evento criado ainda. Que tal marcar a próxima jogatina?</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {events.map(ev => (
              <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <h3 style={{ margin: '0 0 5px 0' }}>{ev.title}</h3>
                  <small style={{ color: 'var(--text-secondary)' }}>Status: {ev.status}</small>
                </div>
                <button onClick={() => navigate(`/event/${id}/${ev.id}`)} className="btn-primary" style={{ padding: '8px 16px' }}>
                  Acessar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '30px' }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Nova Jogatina</h2>
            <form onSubmit={handleCreateEvent}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Título do Evento</label>
                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Sessão de Inverno" style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
              </div>
              
              <div style={{ marginBottom: '30px', padding: '15px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <label style={{ display: 'block', marginBottom: '15px', fontWeight: 'bold' }}>Opções de Datas e Horários</label>
                {dateInputs.map((item, idx) => (
                  <div key={item.id} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input required={idx === 0} type="date" value={item.date} onChange={e => {
                      const n = [...dateInputs]; n[idx].date = e.target.value; setDateInputs(n);
                    }} style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', colorScheme: 'dark' }} />
                    
                    <input required={idx === 0} type="time" value={item.startTime} onChange={e => {
                      const n = [...dateInputs]; n[idx].startTime = e.target.value; setDateInputs(n);
                    }} style={{ width: '120px', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', colorScheme: 'dark' }} />
                    
                    <span style={{ color: 'var(--text-secondary)' }}>até</span>
                    
                    <input type="time" value={item.endTime || ''} onChange={e => {
                      const n = [...dateInputs]; n[idx].endTime = e.target.value; setDateInputs(n);
                    }} placeholder="Opcional" style={{ width: '120px', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', colorScheme: 'dark' }} />
                  </div>
                ))}
                <button type="button" onClick={() => setDateInputs([...dateInputs, { id: Date.now().toString(), date: '', startTime: '', endTime: '' }])} style={{ background: 'transparent', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', fontSize: '0.9rem', marginTop: '10px' }}>+ Adicionar outra data</button>
              </div>

              <div style={{ marginBottom: '30px', padding: '15px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <label style={{ display: 'block', marginBottom: '15px', fontWeight: 'bold' }}>Opções de Locais</label>
                {locationInputs.map((item, idx) => (
                  <div key={item.id} style={{ marginBottom: '15px', padding: '15px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    
                    {favorites.length > 0 && (
                      <div style={{ marginBottom: '10px', display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '5px' }}>
                        {favorites.map(f => (
                          <button type="button" key={f.id} onClick={() => applyFavorite(f, idx)} style={{ fontSize: '0.75rem', padding: '4px 8px', borderRadius: 'var(--radius-full)', background: 'var(--accent-primary-transparent)', color: 'var(--accent-primary)', border: 'none', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                            ⭐ {f.name}
                          </button>
                        ))}
                      </div>
                    )}

                    <input required={idx === 0} type="text" value={item.name} onChange={e => {
                      const n = [...locationInputs]; n[idx].name = e.target.value; setLocationInputs(n);
                    }} placeholder="Nome (Ex: Casa do Edu)" style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
                    
                    <input required={idx === 0} type="text" value={item.address} onChange={e => {
                      const n = [...locationInputs]; n[idx].address = e.target.value; setLocationInputs(n);
                    }} placeholder="Endereço Completo (para o Waze/Maps)" style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={item.saveFavorite} onChange={e => {
                        const n = [...locationInputs]; n[idx].saveFavorite = e.target.checked; setLocationInputs(n);
                      }} />
                      Salvar este local aos Meus Favoritos
                    </label>
                  </div>
                ))}
                <button type="button" onClick={() => setLocationInputs([...locationInputs, { id: Date.now().toString(), name: '', address: '', saveFavorite: false }])} style={{ background: 'transparent', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>+ Adicionar outro local</button>
              </div>

              <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn-danger" style={{ background: 'transparent', border: 'none' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Criar e Abrir Votação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

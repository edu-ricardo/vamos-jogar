import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { groupService } from '../services/groupService';
import { eventService, type Event } from '../services/eventService';

export const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [upcomingEvents, setUpcomingEvents] = useState<{event: Event, groupName: string, groupId: string, displayDate: string, displayTime: string, displayLocation: string}[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    const loadUpcomingEvents = async () => {
      if (!user) return;
      try {
        const groups = await groupService.fetchUserGroups(user.uid);
        let allFutureEvents: {event: Event, groupName: string, groupId: string, displayDate: string, displayTime: string, displayLocation: string}[] = [];
        
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Considerar eventos a partir de hoje

        for (const group of groups) {
          const events = await eventService.fetchGroupEvents(group.id);
          const futureEvents = events.filter((e: Event) => {
            const dateStr = e.finalDateId 
              ? e.dateOptions.find(d => d.id === e.finalDateId)?.date 
              : e.dateOptions[0]?.date;
            
            if (!dateStr) return false;
            
            const eventDate = new Date(dateStr);
            return eventDate >= now;
          }).map((e: Event) => {
            const dateObj = e.finalDateId 
              ? e.dateOptions.find(d => d.id === e.finalDateId)
              : e.dateOptions[0];
            const locObj = e.finalLocationId 
              ? e.locationOptions.find(l => l.id === e.finalLocationId)
              : e.locationOptions[0];
            
            return {
              event: e,
              groupName: group.name,
              groupId: group.id,
              displayDate: dateObj?.date || '',
              displayTime: dateObj?.startTime || '',
              displayLocation: locObj?.name || 'Local a definir'
            };
          });
          
          allFutureEvents = [...allFutureEvents, ...futureEvents];
        }

        // Ordenar do mais próximo pro mais distante
        allFutureEvents.sort((a, b) => new Date(a.displayDate).getTime() - new Date(b.displayDate).getTime());
        
        setUpcomingEvents(allFutureEvents);
      } catch (err) {
        console.error("Erro ao carregar eventos globais:", err);
      } finally {
        setLoadingEvents(false);
      }
    };

    loadUpcomingEvents();
  }, [user]);

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '40px' }}>
        <button 
          onClick={() => navigate('/ludoteca')} 
          className="btn-primary" 
          style={{ width: '100%', padding: '20px', fontSize: '1.2rem', background: 'transparent', border: '1px solid #fff', borderRadius: '12px' }}
        >
          Ludoteca
        </button>
        <button 
          onClick={() => navigate('/grupos')} 
          className="btn-primary" 
          style={{ width: '100%', padding: '20px', fontSize: '1.2rem', background: 'transparent', border: '1px solid #fff', borderRadius: '12px' }}
        >
          Grupos
        </button>
      </div>

      <section style={{ border: '1px solid #333', borderRadius: '12px', padding: '20px', background: 'rgba(255,255,255,0.02)' }}>
        <h2 style={{ marginTop: 0, borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '15px' }}>Próximos Eventos</h2>
        
        {loadingEvents ? (
          <p style={{ color: '#a1a1aa', textAlign: 'center' }}>Buscando eventos...</p>
        ) : upcomingEvents.length === 0 ? (
          <p style={{ color: '#a1a1aa', textAlign: 'center' }}>Nenhum evento agendado para o futuro.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {upcomingEvents.map(item => (
              <div 
                key={item.event.id} 
                onClick={() => navigate(`/event/${item.groupId}/${item.event.id}`)}
                style={{ 
                  padding: '15px', 
                  border: '1px solid #444', 
                  borderRadius: '8px', 
                  cursor: 'pointer',
                  background: 'rgba(0,0,0,0.3)',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.3)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <h4 style={{ margin: 0 }}>{item.groupName}</h4>
                  <span style={{ fontSize: '0.8rem', color: '#7e22ce', fontWeight: 'bold' }}>
                    {item.displayDate ? new Date(item.displayDate).toLocaleDateString('pt-BR') : ''} às {item.displayTime}
                  </span>
                </div>
                <p style={{ margin: 0, color: '#a1a1aa', fontSize: '0.9rem' }}>Local: {item.displayLocation}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

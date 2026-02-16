import { useState, useEffect, useRef } from 'react';
import fuzzy from '../utils/fuzzy';
import { useAuth } from '../context/AuthContext';
import eventService from '../services/eventService';
import EventCard from '../components/common/EventCard';
import LoadingSpinner from '../components/common/LoadingSpinner';

const BrowseEventsPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    type: '', eligibility: '', startDate: '', endDate: '', followed: '', sort: '', minFee: '', maxFee: ''
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    eventService.getTrending(5).then(res => setTrending(res.events || [])).catch(() => {});
  }, []);

  useEffect(() => { fetchEvents(); }, [page, filters]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 12, status: 'published' };
      if (search) params.search = search;
      if (filters.type) params.type = filters.type;
      if (filters.eligibility) params.eligibility = filters.eligibility;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.followed === 'true') params.followed = 'true';
      if (filters.sort) params.sort = filters.sort;
      if (filters.minFee) params.minFee = filters.minFee;
      if (filters.maxFee) params.maxFee = filters.maxFee;
      const res = await eventService.getEvents(params);
      setEvents(res.events || []);
      setTotalPages(res.pages || 1);
      setTotal(res.total || 0);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    // If search term looks like a short phrase, do a quick client-side fuzzy filter
    const term = (search || '').trim();
    if (term && events.length > 0) {
      const filtered = events.filter(ev =>
        fuzzy.matchesFuzzy(ev.name || '', term) ||
        fuzzy.matchesFuzzy(ev.description || '', term) ||
        fuzzy.matchesFuzzy(ev.venue || '', term) ||
        fuzzy.matchesFuzzy(ev.organizer?.organizerName || '', term)
      );
      // Show quick results without hitting API
      setEvents(filtered);
      return;
    }
    fetchEvents();
  };

  // Debounced live-search: when user types, wait 300ms before applying client-side fuzzy filter
  const searchDebounceRef = useRef(null);
  useEffect(() => {
    // if user cleared search, refetch full list
    if (!search) {
      // small debounce to avoid rapid fetches
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => { setPage(1); fetchEvents(); }, 250);
      return;
    }

    // if we have local events loaded, do client-side fuzzy filtering for instant feedback
    if (events.length > 0) {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        const term = search.trim();
        const filtered = events.filter(ev =>
          fuzzy.matchesFuzzy(ev.name || '', term) ||
          fuzzy.matchesFuzzy(ev.description || '', term) ||
          fuzzy.matchesFuzzy(ev.venue || '', term) ||
          fuzzy.matchesFuzzy(ev.organizer?.organizerName || '', term)
        );
        setEvents(filtered);
      }, 300);
    }
    // cleanup on unmount
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const clearFilters = () => {
    setFilters({ type: '', eligibility: '', startDate: '', endDate: '', followed: '', sort: '', minFee: '', maxFee: '' });
    setSearch('');
    setPage(1);
  };

  const hasActiveFilters = filters.type || filters.eligibility || filters.startDate || filters.endDate || filters.followed || filters.sort || filters.minFee || filters.maxFee;

  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      <div className="page-header-row">
        <div>
          <h1>Browse Events</h1>
          <p className="text-muted" style={{ marginTop: 4 }}>Discover events and merchandise at Felicity</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasActiveFilters && (
            <button className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear Filters</button>
          )}
          <button className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setShowFilters(!showFilters)}>
            {'\u{1F50D}'} Filters {hasActiveFilters ? `(${[filters.type, filters.eligibility, filters.startDate, filters.endDate, filters.followed].filter(Boolean).length})` : ''}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="search-bar-v2">
        <div className="dashboard-search" style={{ flex: 1 }}>
          <span className="search-icon-inner">{'\u{1F50D}'}</span>
          <input className="form-control search-input" placeholder="Search events, organizers, venues..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary">Search</button>
      </form>

      {/* Filter Panel */}
      {showFilters && (
        <div className="filter-panel">
          <div className="filter-panel-grid">
            <div className="form-group">
              <label>Event Type</label>
              <select className="form-control" value={filters.type}
                onChange={e => { setFilters(f => ({ ...f, type: e.target.value })); setPage(1); }}>
                <option value="">All Types</option>
                <option value="normal">Events</option>
                <option value="merchandise">Merchandise</option>
              </select>
            </div>
            <div className="form-group">
              <label>Eligibility</label>
              <select className="form-control" value={filters.eligibility}
                onChange={e => { setFilters(f => ({ ...f, eligibility: e.target.value })); setPage(1); }}>
                <option value="">All</option>
                <option value="all">Open to All</option>
                <option value="iiit-only">IIIT Only</option>
                <option value="non-iiit-only">Non-IIIT Only</option>
              </select>
            </div>
            <div className="form-group">
              <label>Start Date</label>
              <input type="date" className="form-control" value={filters.startDate}
                onChange={e => { setFilters(f => ({ ...f, startDate: e.target.value })); setPage(1); }} />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input type="date" className="form-control" value={filters.endDate}
                onChange={e => { setFilters(f => ({ ...f, endDate: e.target.value })); setPage(1); }} />
            </div>
            {user && user.role === 'participant' && (
              <div className="form-group">
                <label>Show</label>
                <select className="form-control" value={filters.followed}
                  onChange={e => { setFilters(f => ({ ...f, followed: e.target.value })); setPage(1); }}>
                  <option value="">All Events</option>
                  <option value="true">Followed Clubs Only</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label>Sort By</label>
              <select className="form-control" value={filters.sort}
                onChange={e => { setFilters(f => ({ ...f, sort: e.target.value })); setPage(1); }}>
                <option value="">Date (Soonest)</option>
                <option value="newest">Newest First</option>
                <option value="popularity">Popularity</option>
                <option value="fee-asc">Fee: Low to High</option>
                <option value="fee-desc">Fee: High to Low</option>
              </select>
            </div>
            <div className="form-group">
              <label>Min Fee (₹)</label>
              <input type="number" className="form-control" placeholder="0" value={filters.minFee}
                onChange={e => { setFilters(f => ({ ...f, minFee: e.target.value })); setPage(1); }} min="0" />
            </div>
            <div className="form-group">
              <label>Max Fee (₹)</label>
              <input type="number" className="form-control" placeholder="Any" value={filters.maxFee}
                onChange={e => { setFilters(f => ({ ...f, maxFee: e.target.value })); setPage(1); }} min="0" />
            </div>
          </div>
        </div>
      )}

      {/* Trending Section */}
      {trending.length > 0 && !search && !hasActiveFilters && (
        <div className="trending-section">
          <h3 className="section-title">{'\u{1F525}'} Trending Now</h3>
          <div className="grid grid-3">
            {trending.map(ev => <EventCard key={ev._id} event={ev} />)}
          </div>
        </div>
      )}

      {/* Results */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="section-title">{search || hasActiveFilters ? 'Search Results' : 'All Events'}</h3>
          <span className="text-muted" style={{ fontSize: 13 }}>{total} event{total !== 1 ? 's' : ''} found</span>
        </div>

        {loading ? <LoadingSpinner /> : events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">{'\u{1F50D}'}</div>
            <h3>No events found</h3>
            <p className="text-muted">Try adjusting your search or filters</p>
            {hasActiveFilters && (
              <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={clearFilters}>Clear All Filters</button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-3">
              {events.map(ev => <EventCard key={ev._id} event={ev} />)}
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  {'\u2190'} Previous
                </button>
                <div className="page-numbers">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 7) pageNum = i + 1;
                    else if (page <= 4) pageNum = i + 1;
                    else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
                    else pageNum = page - 3 + i;
                    return (
                      <button key={pageNum}
                        className={`btn btn-sm ${pageNum === page ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setPage(pageNum)}>
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  Next {'\u2192'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BrowseEventsPage;

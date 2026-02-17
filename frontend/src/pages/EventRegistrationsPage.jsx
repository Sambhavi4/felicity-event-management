import { useState, useEffect } from 'react';
import fuzzy from '../utils/fuzzy';
import { useParams } from 'react-router-dom';
import registrationService from '../services/registrationService';
import eventService from '../services/eventService';
import api, { getUploadUrl } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const EventRegistrationsPage = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tab, setTab] = useState('registrations');
  const [scanResult, setScanResult] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [attendanceDash, setAttendanceDash] = useState(null);

  useEffect(() => {
    loadData();
  }, [eventId]);

  const loadData = async () => {
      try {
      const [evRes, regRes] = await Promise.all([
        eventService.getEvent(eventId),
        registrationService.getEventRegistrations(eventId, { search, status: statusFilter })
      ]);
      setEvent(evRes.event);
      setRegistrations(regRes.registrations || []);
    } catch (_err) {
      console.error(_err);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceDashboard = async () => {
      try {
        const res = await api.get(`/registrations/event/${eventId}/attendance`);
        setAttendanceDash(res.data);
      } catch (err) {
        console.error('Failed to load attendance dashboard', err);
      }
  };

  const handleSearch = () => {
    // Client-side fuzzy filter for quick responsiveness
    if (!search.trim()) {
      // fallback to server fetch for latest data
      setLoading(true);
      registrationService.getEventRegistrations(eventId, { search: '', status: statusFilter })
        .then(res => setRegistrations(res.registrations || []))
        .finally(() => setLoading(false));
      return;
    }
    const term = search.trim();
    const filtered = registrations.filter(r =>
      fuzzy.matchesFuzzy(r.participant?.firstName || '', term) ||
      fuzzy.matchesFuzzy(r.participant?.lastName || '', term) ||
      fuzzy.matchesFuzzy(r.participant?.email || '', term) ||
      fuzzy.matchesFuzzy(r.ticketId || '', term)
    );
    setRegistrations(filtered);
  };

  const handleExport = async () => {
    try {
      const blob = await registrationService.exportRegistrations(eventId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `registrations_${eventId}.csv`;
      a.click();
      toast.success('CSV exported');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleMarkAttendance = async (regId) => {
    try {
      await registrationService.markAttendance(regId);
      toast.success('Attendance marked');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark attendance');
    }
  };

  const handlePaymentAction = async (regId, action) => {
    try {
      await api.put(`/registrations/${regId}/payment-action`, { action });
      toast.success(`Payment ${action}d`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleQRScan = async () => {
    if (!scanInput.trim()) return;
    try {
      // Try parsing as JSON (QR data format)
      let ticketId;
      try {
        const parsed = JSON.parse(scanInput);
        ticketId = parsed.ticketId;
      } catch {
        ticketId = scanInput.trim();
      }
      const res = await api.post(`/registrations/scan-qr`, { qrData: scanInput });
      setScanResult(`Attendance marked for: ${res.data.registration?.participant?.firstName || 'Participant'} (${ticketId})`);
      setScanInput('');
      loadData();
    } catch (_err) {
      setScanResult(`Error: ${_err.response?.data?.message || 'Invalid QR'}`);
    }
  };

  if (loading) return <LoadingSpinner />;

  const pendingPayments = registrations.filter(r => r.paymentStatus === 'pending');
  const allMerchOrders = registrations.filter(r => r.registrationType === 'merchandise');
  const allPaymentRegs = registrations.filter(r => r.paymentStatus && r.paymentStatus !== 'not_required');
  const isMerchEvent = event?.eventType === 'merchandise';
  const hasPaymentRegs = allPaymentRegs.length > 0 || isMerchEvent || (event?.registrationFee > 0);

  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      <div className="page-header-row">
        <div>
          <h1>{event?.name || 'Event'} - Registrations</h1>
          <p className="text-muted" style={{ marginTop: 4 }}>
            Total: {registrations.length} | Attended: {registrations.filter(r => r.attended).length}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={handleExport}>{'\u{1F4E5}'} Export CSV</button>
      </div>

      {/* Stats */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card-v2">
          <div className="stat-card-icon">{'\u{1F4DD}'}</div>
          <div><div className="stat-value-v2">{registrations.length}</div><div className="stat-label-v2">Total</div></div>
        </div>
        <div className="stat-card-v2">
          <div className="stat-card-icon">{'\u2705'}</div>
          <div><div className="stat-value-v2">{registrations.filter(r => r.status === 'confirmed').length}</div><div className="stat-label-v2">Confirmed</div></div>
        </div>
        <div className="stat-card-v2">
          <div className="stat-card-icon">{'\u{1F3AF}'}</div>
          <div><div className="stat-value-v2">{registrations.filter(r => r.attended).length}</div><div className="stat-label-v2">Attended</div></div>
        </div>
        <div className="stat-card-v2">
          <div className="stat-card-icon">{'\u{23F3}'}</div>
          <div><div className="stat-value-v2">{pendingPayments.length}</div><div className="stat-label-v2">Pending</div></div>
        </div>
      </div>

      <div className="tabs">
            <button className={`tab ${tab === 'registrations' ? 'active' : ''}`} onClick={() => setTab('registrations')}>
              Registrations
            </button>
            <button className={`tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => { setTab('dashboard'); loadAttendanceDashboard(); }}>
              Attendance Dashboard
            </button>
            {hasPaymentRegs && (
              <button className={`tab ${tab === 'payments' ? 'active' : ''}`} onClick={() => setTab('payments')}>
                💳 Payments {pendingPayments.length > 0 && `(${pendingPayments.length} pending)`}
              </button>
            )}
          </div>

      {tab === 'registrations' && (
        <>
          <div className="filter-bar">
            <div className="dashboard-search" style={{ flex: 1 }}>
              <span className="search-icon-inner">{'\u{1F50D}'}</span>
              <input className="form-control search-input" placeholder="Search by name or email..."
                value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <select className="form-control filter-select" value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); }}>
              <option value="">All Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="attended">Attended</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button className="btn btn-primary btn-sm" onClick={handleSearch}>Apply</button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Email</th>
                  <th>Ticket ID</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Type</th>
                  <th>Actions</th>
                </tr>
                </thead>
                <tbody>
                {registrations.map(reg => (
                  <tr key={reg._id}>
                    <td>{reg.participant?.firstName} {reg.participant?.lastName}</td>
                    <td>{reg.participant?.email}</td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{reg.ticketId}</td>
                    <td>
                      <span className={`badge ${reg.status === 'confirmed' ? 'badge-success' : reg.status === 'attended' ? 'badge-info' : reg.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                        {reg.status}
                      </span>
                    </td>
                    <td>
                      {reg.paymentStatus && reg.paymentStatus !== 'not_required' ? (
                        <span className={`badge ${reg.paymentStatus === 'approved' ? 'badge-success' : reg.paymentStatus === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                          {reg.paymentStatus}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>{reg.registrationType}</td>
                    <td>
                      {reg.status === 'confirmed' && !reg.attended && (
                        <button className="btn btn-success btn-sm" onClick={() => handleMarkAttendance(reg._id)}>
                          Mark Present
                        </button>
                      )}
                      {/* Organizer: approve/reject inline for pending payments */}
                      {reg.paymentStatus === 'pending' && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <button className="btn btn-success btn-sm" onClick={() => handlePaymentAction(reg._id, 'approve')}>✅ Approve</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handlePaymentAction(reg._id, 'reject')}>❌ Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'attendance' && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>QR Code Scanner</h3>
          <p className="text-muted" style={{ marginBottom: 12, fontSize: 13 }}>
            Paste QR code data or ticket ID to mark attendance
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="form-control" placeholder="Paste QR data or ticket ID..."
              value={scanInput} onChange={e => setScanInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleQRScan()} />
            <button className="btn btn-primary" onClick={handleQRScan}>Scan</button>
          </div>
          {scanResult && (
            <div className={`alert ${scanResult.startsWith('Error') ? 'alert-danger' : 'alert-success'}`} style={{ marginTop: 12 }}>
              {scanResult}
            </div>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div>
          <h3 style={{ marginBottom: 16 }}>💳 Payment Orders</h3>

          {/* Summary stats */}
          <div className="grid grid-4" style={{ marginBottom: 20 }}>
            {[
              { label: 'Total Orders', value: allPaymentRegs.length, icon: '🛍️' },
              { label: 'Pending', value: allPaymentRegs.filter(r => r.paymentStatus === 'pending').length, icon: '⏳' },
              { label: 'Approved', value: allPaymentRegs.filter(r => r.paymentStatus === 'approved').length, icon: '✅' },
              { label: 'Rejected', value: allPaymentRegs.filter(r => r.paymentStatus === 'rejected').length, icon: '❌' },
            ].map(s => (
              <div key={s.label} className="stat-card-v2">
                <div className="stat-card-icon">{s.icon}</div>
                <div><div className="stat-value-v2">{s.value}</div><div className="stat-label-v2">{s.label}</div></div>
              </div>
            ))}
          </div>

          {allPaymentRegs.length === 0 ? (
            <p className="text-muted">No payment orders yet.</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Ticket ID</th>
                    <th>Type</th>
                    {isMerchEvent && <th>Item</th>}
                    {isMerchEvent && <th>Qty</th>}
                    <th>Amount</th>
                    <th>Payment Proof</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allPaymentRegs.map(reg => (
                    <tr key={reg._id}>
                      <td>{reg.participant?.firstName} {reg.participant?.lastName}<br/><span style={{fontSize:11,color:'var(--text-muted)'}}>{reg.participant?.email}</span></td>
                      <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{reg.ticketId}</td>
                      <td>{reg.registrationType}</td>
                      {isMerchEvent && <td>{reg.variantDetails?.name || '—'} {reg.variantDetails?.size ? `(${reg.variantDetails.size})` : ''}</td>}
                      {isMerchEvent && <td>{reg.quantity}</td>}
                      <td>₹{reg.totalAmount || (reg.variantDetails?.price ? reg.variantDetails.price * (reg.quantity || 1) : event?.registrationFee) || 0}</td>
                      <td>
                        {reg.paymentProof ? (
                          <div>
                            <a href={getUploadUrl(reg.paymentProof)} target="_blank" rel="noreferrer" className="btn-link" style={{fontSize:12}}>View Full</a>
                            <div style={{ marginTop: 4 }}>
                              <img src={getUploadUrl(reg.paymentProof)} alt="proof" style={{ maxWidth: 100, maxHeight: 70, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border-color)', cursor: 'pointer' }}
                                onClick={() => window.open(getUploadUrl(reg.paymentProof), '_blank')} />
                            </div>
                          </div>
                        ) : (
                          <span style={{color:'var(--text-muted)', fontSize:12}}>Not uploaded</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${reg.paymentStatus === 'approved' ? 'badge-success' : reg.paymentStatus === 'rejected' ? 'badge-danger' : reg.paymentStatus === 'pending' ? 'badge-warning' : 'badge-primary'}`}>
                          {reg.paymentStatus || 'not_required'}
                        </span>
                      </td>
                      <td>
                        {reg.paymentStatus === 'pending' ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-success btn-sm" onClick={() => handlePaymentAction(reg._id, 'approve')}>✅ Approve</button>
                            <button className="btn btn-danger btn-sm" onClick={() => handlePaymentAction(reg._id, 'reject')}>❌ Reject</button>
                          </div>
                        ) : reg.paymentStatus === 'approved' ? (
                          <span style={{fontSize:12,color:'var(--success-color)'}}>Approved ✓</span>
                        ) : reg.paymentStatus === 'rejected' ? (
                          <span style={{fontSize:12,color:'var(--danger-color)'}}>Rejected</span>
                        ) : (
                          <span style={{fontSize:12,color:'var(--text-muted)'}}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'dashboard' && (
        <div>
          {!attendanceDash ? (
            <LoadingSpinner />
          ) : (
            <>
              <div className="grid grid-3" style={{ marginBottom: 24 }}>
                <div className="stat-card-v2">
                  <div className="stat-card-icon">📊</div>
                  <div><div className="stat-value-v2">{attendanceDash.stats?.total || 0}</div><div className="stat-label-v2">Total Registrations</div></div>
                </div>
                <div className="stat-card-v2">
                  <div className="stat-card-icon">✅</div>
                  <div><div className="stat-value-v2">{attendanceDash.stats?.attended || 0}</div><div className="stat-label-v2">Attended</div></div>
                </div>
                <div className="stat-card-v2">
                  <div className="stat-card-icon">⏳</div>
                  <div><div className="stat-value-v2">{attendanceDash.stats?.pending || 0}</div><div className="stat-label-v2">Remaining</div></div>
                </div>
              </div>

              {/* Attendance Rate Bar */}
              <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 12 }}>Attendance Rate</h3>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, height: 32, overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    width: `${attendanceDash.stats?.total > 0 ? ((attendanceDash.stats.attended / attendanceDash.stats.total) * 100) : 0}%`,
                    height: '100%', background: 'var(--success-color)', borderRadius: 8,
                    transition: 'width 0.5s ease', minWidth: attendanceDash.stats?.attended > 0 ? 40 : 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 600
                  }}>
                    {attendanceDash.stats?.total > 0 ? `${Math.round((attendanceDash.stats.attended / attendanceDash.stats.total) * 100)}%` : '0%'}
                  </div>
                </div>
              </div>

              {/* Not Yet Attended List */}
              <div className="card">
                <h3 style={{ marginBottom: 12 }}>Not Yet Attended ({attendanceDash.notAttendedList?.length || 0})</h3>
                {attendanceDash.notAttendedList && attendanceDash.notAttendedList.length > 0 ? (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr><th>Name</th><th>Email</th><th>Ticket ID</th><th>Action</th></tr>
                      </thead>
                      <tbody>
                        {attendanceDash.notAttendedList.map(r => (
                          <tr key={r._id}>
                            <td>{r.participant?.firstName} {r.participant?.lastName}</td>
                            <td>{r.participant?.email}</td>
                            <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{r.ticketId}</td>
                            <td>
                              <button className="btn btn-success btn-sm" onClick={() => { handleMarkAttendance(r._id); loadAttendanceDashboard(); }}>
                                Mark Present
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted">All participants have been marked as attended!</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default EventRegistrationsPage;

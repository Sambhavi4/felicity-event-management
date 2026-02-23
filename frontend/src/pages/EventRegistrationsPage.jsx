import { useState, useEffect, useRef, useCallback } from 'react';
import fuzzy from '../utils/fuzzy';
import { useParams } from 'react-router-dom';
import registrationService from '../services/registrationService';
import eventService from '../services/eventService';
import api, { getUploadUrl } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import jsQR from 'jsqr';

/* ── Helper: format date/time ── */
const fmt = (d) => d ? new Date(d).toLocaleString() : '—';

/* ── Helper: decode QR from an image element, video frame, or canvas ── */
const detectQR = async (source) => {
  try {
    // Draw source onto a temporary canvas to get pixel data
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const w = source.videoWidth || source.naturalWidth || source.width;
    const h = source.videoHeight || source.naturalHeight || source.height;
    if (!w || !h) return null;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(source, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const code = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
    return code ? code.data : null;
  } catch { return null; }
};

/* ── Helper: decode QR from canvas element directly ── */
const detectQRFromCanvas = (canvas) => {
  try {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
    return code ? code.data : null;
  } catch { return null; }
};

const EventRegistrationsPage = () => {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tab, setTab] = useState('registrations');

  // QR scanner
  const [scanResult, setScanResult] = useState(null); // { ok: bool|null, message }
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [camActive, setCamActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const scanLoopRef = useRef(null);
  const streamRef = useRef(null);

  // Attendance dashboard
  const [attendanceDash, setAttendanceDash] = useState(null);

  // Manual override modal
  const [overrideModal, setOverrideModal] = useState(null); // { regId, name }
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    loadData();
    return () => stopCamera();
  }, [eventId]);

  useEffect(() => {
    if (tab !== 'attendance') stopCamera();
  }, [tab]);

  const loadData = async () => {
    try {
      const [evRes, regRes] = await Promise.all([
        eventService.getEvent(eventId),
        registrationService.getEventRegistrations(eventId, { search, status: statusFilter })
      ]);
      setEvent(evRes.event);
      setRegistrations(regRes.registrations || []);
    } catch (_err) { console.error(_err); }
    finally { setLoading(false); }
  };

  const loadAttendanceDashboard = async () => {
    try {
      const res = await api.get(`/registrations/event/${eventId}/attendance`);
      setAttendanceDash(res.data);
    } catch (err) { console.error('Attendance dashboard error', err); }
  };

  const handleSearch = () => {
    if (!search.trim()) {
      setLoading(true);
      registrationService.getEventRegistrations(eventId, { search: '', status: statusFilter })
        .then(res => setRegistrations(res.registrations || []))
        .finally(() => setLoading(false));
      return;
    }
    const term = search.trim();
    setRegistrations(prev => prev.filter(r =>
      fuzzy.matchesFuzzy(r.participant?.firstName || '', term) ||
      fuzzy.matchesFuzzy(r.participant?.lastName || '', term) ||
      fuzzy.matchesFuzzy(r.participant?.email || '', term) ||
      fuzzy.matchesFuzzy(r.ticketId || '', term)
    ));
  };

  const handleExport = async () => {
    try {
      const blob = await registrationService.exportRegistrations(eventId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `registrations_${eventId}.csv`; a.click();
      toast.success('CSV exported');
    } catch { toast.error('Export failed'); }
  };

  const handleExportAttendance = async () => {
    try {
      const blob = await registrationService.exportAttendance(eventId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `attendance_${eventId}.csv`; a.click();
      toast.success('Attendance CSV exported');
    } catch { toast.error('Export failed'); }
  };

  const handleMarkAttendance = async (regId) => {
    try {
      await registrationService.markAttendance(regId);
      toast.success('Attendance marked');
      loadData();
      if (tab === 'dashboard') loadAttendanceDashboard();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handlePaymentAction = async (regId, action) => {
    try {
      await api.put(`/registrations/${regId}/payment-action`, { action });
      toast.success(`Payment ${action}d`);
      loadData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  /* ── QR submit ── */
  const submitQRData = useCallback(async (raw) => {
    if (!raw || scanning) return;
    setScanning(true);
    try {
      const res = await api.post(`/registrations/scan-qr`, { qrData: raw });
      if (res.data.duplicate) {
        setScanResult({ ok: false, duplicate: true, message: '⚠️ Duplicate scan — ' + res.data.message });
        toast.error('Already scanned');
      } else if (res.data.success) {
        const p = res.data.registration?.participant;
        const name = p ? `${p.firstName} ${p.lastName}` : 'Participant';
        setScanResult({ ok: true, message: `✅ Attendance marked for ${name}` });
        toast.success(`Marked: ${name}`);
        loadData();
        if (tab === 'dashboard') loadAttendanceDashboard();
      } else {
        setScanResult({ ok: false, message: '❌ ' + (res.data.message || 'Scan failed') });
        toast.error(res.data.message || 'Scan failed');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid QR or ticket not found';
      setScanResult({ ok: false, message: `❌ ${msg}` });
      toast.error(msg);
    } finally { setScanning(false); setScanInput(''); }
  }, [scanning, tab]);

  const handlePasteScan = () => submitQRData(scanInput.trim());

  /* ── File QR ── */
  const handleFileQR = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // Text/JSON files — read content directly as ticket data
    if (file.type === 'application/json' || file.name.endsWith('.json') || file.type === 'text/plain' || file.name.endsWith('.txt')) {
      try {
        const text = await file.text();
        if (text.trim()) { await submitQRData(text.trim()); return; }
      } catch { /* fall through */ }
    }

    // Image files — decode QR using jsQR (works in ALL browsers)
    if (file.type?.startsWith('image/')) {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = async () => {
        const val = await detectQR(img);
        URL.revokeObjectURL(objectUrl);
        if (val) {
          setScanResult({ ok: null, message: 'QR detected — submitting...' });
          await submitQRData(val);
        } else {
          setScanResult({ ok: false, message: '❌ No QR code found in image. Make sure the image contains a clear QR code, or paste your ticket ID below.' });
          toast.error('No QR found in image');
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setScanResult({ ok: false, message: '❌ Could not load image. Try a different file or paste the ticket ID below.' });
      };
      img.src = objectUrl;
      return;
    }

    setScanResult({ ok: false, message: '❌ Unsupported file type. Upload a QR image (PNG/JPG) or a text/JSON file with ticket data.' });
  };

  /* ── Camera ── */
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setCamActive(true);
      startScanLoop();
    } catch (err) { toast.error('Camera access denied: ' + err.message); }
  };

  const stopCamera = () => {
    if (scanLoopRef.current) { cancelAnimationFrame(scanLoopRef.current); scanLoopRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCamActive(false);
  };

  const startScanLoop = () => {
    const loop = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !streamRef.current) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        const val = detectQRFromCanvas(canvas);
        if (val) { stopCamera(); setScanResult({ ok: null, message: 'QR detected — submitting...' }); await submitQRData(val); return; }
      }
      scanLoopRef.current = requestAnimationFrame(loop);
    };
    scanLoopRef.current = requestAnimationFrame(loop);
  };

  /* ── Manual override ── */
  const handleManualOverride = async () => {
    if (!overrideModal) return;
    const reason = overrideReason.trim() || 'Manual override by organizer';
    try {
      await registrationService.manualAttendanceOverride(overrideModal.regId, reason);
      toast.success(`Override applied for ${overrideModal.name}`);
      setOverrideModal(null); setOverrideReason('');
      loadData(); loadAttendanceDashboard();
    } catch (err) { toast.error(err.response?.data?.message || 'Override failed'); }
  };

  if (loading) return <LoadingSpinner />;

  const pendingPayments = registrations.filter(r => r.paymentStatus === 'pending');
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
        <button className="btn btn-secondary" onClick={handleExport}>📥 Export CSV</button>
      </div>

      {/* Stats */}
      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        {[
          { icon: '📝', value: registrations.length, label: 'Total' },
          { icon: '✅', value: registrations.filter(r => r.status === 'confirmed').length, label: 'Confirmed' },
          { icon: '🎯', value: registrations.filter(r => r.attended).length, label: 'Attended' },
          { icon: '⏳', value: pendingPayments.length, label: 'Pending' },
        ].map(s => (
          <div key={s.label} className="stat-card-v2">
            <div className="stat-card-icon">{s.icon}</div>
            <div><div className="stat-value-v2">{s.value}</div><div className="stat-label-v2">{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'registrations' ? 'active' : ''}`} onClick={() => setTab('registrations')}>
          Registrations
        </button>
        <button className={`tab ${tab === 'attendance' ? 'active' : ''}`}
          onClick={() => { setTab('attendance'); setScanResult(null); setScanInput(''); }}>
          📷 QR Scanner
        </button>
        <button className={`tab ${tab === 'dashboard' ? 'active' : ''}`}
          onClick={() => { setTab('dashboard'); loadAttendanceDashboard(); }}>
          Attendance Dashboard
        </button>
        {hasPaymentRegs && (
          <button className={`tab ${tab === 'payments' ? 'active' : ''}`} onClick={() => setTab('payments')}>
            💳 Payments {pendingPayments.length > 0 && `(${pendingPayments.length} pending)`}
          </button>
        )}
      </div>

      {/* ── REGISTRATIONS TAB ── */}
      {tab === 'registrations' && (
        <>
          <div className="filter-bar">
            <div className="dashboard-search" style={{ flex: 1 }}>
              <span className="search-icon-inner">🔍</span>
              <input className="form-control search-input" placeholder="Search by name or email..."
                value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            </div>
            <select className="form-control filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
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
                  <th>Participant</th><th>Email</th><th>Ticket ID</th>
                  <th>Status</th><th>Payment</th><th>Attendance</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map(reg => (
                  <tr key={reg._id}>
                    <td>{reg.participant?.firstName} {reg.participant?.lastName}</td>
                    <td>{reg.participant?.email}</td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{reg.ticketId}</td>
                    <td>
                      <span className={`badge ${reg.status === 'confirmed' ? 'badge-success' : reg.status === 'attended' ? 'badge-info' : reg.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}
                        style={{ padding: '4px 10px', borderRadius: 20, fontWeight: 600, fontSize: 11, letterSpacing: 0.3 }}>
                        {reg.status === 'confirmed' ? '✓ Confirmed' : reg.status === 'attended' ? '🎯 Attended' : reg.status === 'cancelled' ? '✗ Cancelled' : '⏳ Pending'}
                      </span>
                    </td>
                    <td>
                      {reg.paymentStatus && reg.paymentStatus !== 'not_required'
                        ? <span className={`badge ${reg.paymentStatus === 'approved' ? 'badge-success' : reg.paymentStatus === 'rejected' ? 'badge-danger' : 'badge-warning'}`}
                            style={{ padding: '4px 10px', borderRadius: 20, fontWeight: 600, fontSize: 11 }}>
                            {reg.paymentStatus === 'approved' ? '✓ Paid' : reg.paymentStatus === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                          </span>
                        : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Free</span>}
                    </td>
                    <td>
                      {reg.attended ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(34,197,94,0.12)', color: '#16a34a', padding: '4px 10px', borderRadius: 20, fontWeight: 600, fontSize: 11 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }}></span>
                          Present {reg.attendedAt ? new Date(reg.attendedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(234,179,8,0.12)', color: '#ca8a04', padding: '4px 10px', borderRadius: 20, fontWeight: 600, fontSize: 11 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ca8a04', display: 'inline-block' }}></span>
                          Absent
                        </span>
                      )}
                    </td>
                    <td>
                      {reg.paymentStatus === 'pending' && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => handlePaymentAction(reg._id, 'approve')}
                            style={{ background: 'rgba(34,197,94,0.15)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12, transition: 'all .15s' }}
                            onMouseOver={e => e.target.style.background='rgba(34,197,94,0.3)'} onMouseOut={e => e.target.style.background='rgba(34,197,94,0.15)'}>
                            ✓ Approve
                          </button>
                          <button onClick={() => handlePaymentAction(reg._id, 'reject')}
                            style={{ background: 'rgba(239,68,68,0.12)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12, transition: 'all .15s' }}
                            onMouseOver={e => e.target.style.background='rgba(239,68,68,0.25)'} onMouseOut={e => e.target.style.background='rgba(239,68,68,0.12)'}>
                            ✗ Reject
                          </button>
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

      {/* ── QR SCANNER TAB (was broken: tab==='attendance' never reachable before) ── */}
      {tab === 'attendance' && (
        <div className="card" style={{ maxWidth: 620 }}>
          <h3 style={{ marginBottom: 4 }}>📷 QR Code Scanner</h3>
          <p className="text-muted" style={{ marginBottom: 16, fontSize: 13 }}>
            Scan participant QR codes to mark attendance. Duplicate scans are rejected automatically.
          </p>

          {scanResult && (
            <div className={`alert ${scanResult.ok === true ? 'alert-success' : scanResult.ok === false ? 'alert-danger' : 'alert-warning'}`}
              style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{scanResult.message}</span>
              <button onClick={() => setScanResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
          )}

          {/* Camera */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              📹 Camera Scan
            </div>
            {!camActive ? (
              <button className="btn btn-primary" onClick={startCamera}>Start Camera</button>
            ) : (
              <div>
                <video ref={videoRef} style={{ width: '100%', maxWidth: 480, borderRadius: 8, border: '2px solid var(--primary-color)' }} playsInline muted />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <div style={{ marginTop: 8 }}>
                  <button className="btn btn-danger btn-sm" onClick={stopCamera}>Stop Camera</button>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 12 }}>Aim at QR code — auto-detects</span>
                </div>
              </div>
            )}
          </div>

          {/* File upload */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              🖼️ Upload QR Image
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,.json,.txt" style={{ display: 'none' }} onChange={handleFileQR} />
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              Choose Image File
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>Supports PNG, JPG, or text/JSON files</span>
          </div>

          {/* Paste */}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>⌨️ Paste / Type QR Data</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-control" placeholder="Paste QR data or ticket ID (e.g. FEL-XXXXXX)..."
                value={scanInput} onChange={e => setScanInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePasteScan()} />
              <button className="btn btn-primary" onClick={handlePasteScan} disabled={scanning || !scanInput.trim()}>
                {scanning ? '...' : 'Scan'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Works in all browsers. Paste full QR JSON or just the ticket ID.</p>
          </div>
        </div>
      )}

      {/* ── ATTENDANCE DASHBOARD TAB ── */}
      {tab === 'dashboard' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleExportAttendance}>📥 Export Attendance CSV</button>
          </div>
          {!attendanceDash ? <LoadingSpinner /> : (
            <>
              <div className="grid grid-3" style={{ marginBottom: 24 }}>
                {[
                  { icon: '📊', value: attendanceDash.stats?.total || 0, label: 'Total Registrations' },
                  { icon: '✅', value: attendanceDash.stats?.attended || 0, label: 'Scanned / Attended' },
                  { icon: '⏳', value: attendanceDash.stats?.pending || 0, label: 'Not Yet Scanned' },
                ].map(s => (
                  <div key={s.label} className="stat-card-v2">
                    <div className="stat-card-icon">{s.icon}</div>
                    <div><div className="stat-value-v2">{s.value}</div><div className="stat-label-v2">{s.label}</div></div>
                  </div>
                ))}
              </div>

              <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 12 }}>Attendance Rate</h3>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, height: 32, overflow: 'hidden' }}>
                  {(() => {
                    const pct = attendanceDash.stats?.total > 0 ? Math.round((attendanceDash.stats.attended / attendanceDash.stats.total) * 100) : 0;
                    return <div style={{ width: `${pct}%`, height: '100%', background: 'var(--success-color)', borderRadius: 8, transition: 'width .5s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 600, minWidth: pct > 0 ? 40 : 0 }}>{pct}%</div>;
                  })()}
                </div>
              </div>

              {/* Not attended — with Mark Present + Override */}
              <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 12 }}>Not Yet Scanned ({attendanceDash.notAttendedList?.length || 0})</h3>
                <div className="alert alert-warning" style={{ marginBottom: 12, fontSize: 13 }}>
                  ⚠️ Attendance can only be marked by scanning the participant's QR code or entering their ticket ID in the <strong>QR Scanner</strong> tab. Manual override requires a documented reason and is logged for audit.
                </div>
                {attendanceDash.notAttendedList?.length > 0 ? (
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Name</th><th>Email</th><th>Ticket ID</th><th>Action</th></tr></thead>
                      <tbody>
                        {attendanceDash.notAttendedList.map(r => (
                          <tr key={r._id}>
                            <td>{r.participant?.firstName} {r.participant?.lastName}</td>
                            <td>{r.participant?.email}</td>
                            <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{r.ticketId}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn btn-warning btn-sm" title="Manual override — requires reason, logged for audit"
                                  onClick={() => { setOverrideModal({ regId: r._id, name: `${r.participant?.firstName} ${r.participant?.lastName}` }); setOverrideReason(''); }}>
                                  ⚠️ Manual Override
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-muted">All participants have been marked as attended!</p>}
              </div>

              {/* Attended list with timestamps */}
              <div className="card">
                <h3 style={{ marginBottom: 12 }}>Attended ({attendanceDash.attendedList?.length || 0})</h3>
                {attendanceDash.attendedList?.length > 0 ? (
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Name</th><th>Email</th><th>Ticket ID</th><th>Attended At</th><th>Method</th></tr></thead>
                      <tbody>
                        {attendanceDash.attendedList.map(r => (
                          <tr key={r._id}>
                            <td>{r.participant?.firstName} {r.participant?.lastName}</td>
                            <td style={{ fontSize: 12 }}>{r.participant?.email}</td>
                            <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{r.ticketId}</td>
                            <td style={{ fontSize: 12 }}>{fmt(r.attendedAt)}</td>
                            <td style={{ fontSize: 12 }}>
                              {r.attendanceOverride?.overridden
                                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(234,179,8,0.12)', color: '#ca8a04', padding: '3px 10px', borderRadius: 16, fontWeight: 600, fontSize: 11, cursor: 'help' }} title={`Reason: ${r.attendanceOverride.reason}`}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ca8a04' }}></span> Manual Override
                                  </span>
                                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(34,197,94,0.12)', color: '#16a34a', padding: '3px 10px', borderRadius: 16, fontWeight: 600, fontSize: 11 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }}></span> QR Scan
                                  </span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-muted">No one has been marked as attended yet.</p>}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── PAYMENTS TAB ── */}
      {tab === 'payments' && (
        <div>
          <h3 style={{ marginBottom: 16 }}>💳 Payment Orders</h3>
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
          {allPaymentRegs.length === 0 ? <p className="text-muted">No payment orders yet.</p> : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Participant</th><th>Ticket ID</th><th>Type</th>
                    {isMerchEvent && <th>Item</th>}{isMerchEvent && <th>Qty</th>}
                    <th>Amount</th><th>Payment Proof</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allPaymentRegs.map(reg => (
                    <tr key={reg._id}>
                      <td>
                        {reg.participant?.firstName} {reg.participant?.lastName}
                        <br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{reg.participant?.email}</span>
                      </td>
                      <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{reg.ticketId}</td>
                      <td>{reg.registrationType}</td>
                      {isMerchEvent && <td>{reg.variantDetails?.name || '—'} {reg.variantDetails?.size ? `(${reg.variantDetails.size})` : ''}</td>}
                      {isMerchEvent && <td>{reg.quantity}</td>}
                      <td>₹{reg.totalAmount || (reg.variantDetails?.price ? reg.variantDetails.price * (reg.quantity || 1) : event?.registrationFee) || 0}</td>
                      <td>
                        {reg.paymentProof ? (
                          <div>
                            <a href={getUploadUrl(reg.paymentProof)} target="_blank" rel="noreferrer" className="btn-link" style={{ fontSize: 12 }}>View Full</a>
                            <div style={{ marginTop: 4 }}>
                              <img src={getUploadUrl(reg.paymentProof)} alt="proof"
                                style={{ maxWidth: 100, maxHeight: 70, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border-color)', cursor: 'pointer' }}
                                onClick={() => window.open(getUploadUrl(reg.paymentProof), '_blank')} />
                            </div>
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Not uploaded</span>}
                      </td>
                      <td>
                        <span className={`badge ${reg.paymentStatus === 'approved' ? 'badge-success' : reg.paymentStatus === 'rejected' ? 'badge-danger' : reg.paymentStatus === 'pending' ? 'badge-warning' : 'badge-primary'}`}
                          style={{ padding: '4px 10px', borderRadius: 20, fontWeight: 600, fontSize: 11 }}>
                          {reg.paymentStatus === 'approved' ? '✓ Approved' : reg.paymentStatus === 'rejected' ? '✗ Rejected' : reg.paymentStatus === 'pending' ? '⏳ Pending' : '—'}
                        </span>
                      </td>
                      <td>
                        {reg.paymentStatus === 'pending' ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => handlePaymentAction(reg._id, 'approve')}
                              style={{ background: 'rgba(34,197,94,0.15)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12, transition: 'all .15s' }}
                              onMouseOver={e => e.target.style.background='rgba(34,197,94,0.3)'} onMouseOut={e => e.target.style.background='rgba(34,197,94,0.15)'}>
                              ✓ Approve
                            </button>
                            <button onClick={() => handlePaymentAction(reg._id, 'reject')}
                              style={{ background: 'rgba(239,68,68,0.12)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12, transition: 'all .15s' }}
                              onMouseOver={e => e.target.style.background='rgba(239,68,68,0.25)'} onMouseOut={e => e.target.style.background='rgba(239,68,68,0.12)'}>
                              ✗ Reject
                            </button>
                          </div>
                        ) : reg.paymentStatus === 'approved' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }}></span> Done
                          </span>
                        ) : reg.paymentStatus === 'rejected' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626' }}></span> Declined
                          </span>
                        ) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MANUAL OVERRIDE MODAL ── */}
      {overrideModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: 420, width: '90%', padding: 24 }}>
            <h3 style={{ marginBottom: 8 }}>⚠️ Manual Attendance Override</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Mark <strong>{overrideModal.name}</strong> as attended without a QR scan.
              This action is logged for audit.
            </p>
            <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>
              Reason <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
            </label>
            <textarea className="form-control" rows={3} placeholder="e.g. QR code damaged, phone dead..."
              value={overrideReason} onChange={e => setOverrideReason(e.target.value)} style={{ marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setOverrideModal(null); setOverrideReason(''); }}>Cancel</button>
              <button className="btn btn-warning" onClick={handleManualOverride}>Apply Override</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventRegistrationsPage;

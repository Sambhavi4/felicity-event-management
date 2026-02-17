import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import registrationService from '../services/registrationService';
import api, { getUploadUrl } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const TicketPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reg, setReg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calendarLinks, setCalendarLinks] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);

  useEffect(() => {
    registrationService.getRegistration(id)
      .then(res => {
        setReg(res.registration);
        // Fetch calendar links for confirmed/attended registrations
        if (res.registration && ['confirmed', 'attended'].includes(res.registration.status)) {
          api.get(`/registrations/${id}/calendar-links`)
            .then(calRes => setCalendarLinks(calRes.data))
            .catch(() => {}); // silently fail
        }
      })
      .catch(() => { toast.error('Ticket not found'); navigate('/dashboard'); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownloadICS = async () => {
    try {
      const res = await api.get(`/registrations/${id}/calendar`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reg.event?.name || 'event'}.ics`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Calendar file downloaded');
    } catch {
      toast.error('Failed to download calendar file');
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel?')) return;
    try {
      await registrationService.cancelRegistration(id);
      toast.success('Registration cancelled');
      // Go back to the event so the EventDetails page can refresh and show cancelled state
      if (reg && reg.event && (reg.event._id || reg.event)) {
        const evId = reg.event._id || reg.event;
        navigate(`/event/${evId}`);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!reg) return null;

  return (
    <div className="container">
      <div className="ticket-container">
        <h2 style={{ marginBottom: 4 }}>{reg.event?.name || 'Event'}</h2>
        <p className="text-muted" style={{ marginBottom: 4 }}>
          {reg.registrationType === 'merchandise' ? 'Merchandise Purchase' : 'Event Registration'}
        </p>
        <p style={{ fontSize: 13 }}>
          <span className={`badge ${reg.status === 'confirmed' ? 'badge-success' : reg.status === 'attended' ? 'badge-info' : reg.status === 'cancelled' ? 'badge-danger' : 'badge-warning'}`}>
            {reg.status}
          </span>
        </p>

        {reg.qrCodeData && (
          <div className="qr-code" style={{ margin: '20px 0' }}>
            <img src={reg.qrCodeData} alt="QR Code" />
          </div>
        )}

        {/* No QR message for pending/rejected payments (merchandise or normal events requiring manual payment).
            Also show when registration has a fee but paymentStatus may be unset (fallback). */}
        {!reg.qrCodeData && ((reg.paymentStatus && reg.paymentStatus !== 'not_required') || (reg.totalAmount && reg.totalAmount > 0)) && (
          <div style={{ margin: '20px 0', padding: 16, background: 'rgba(255,243,205,0.6)', borderRadius: 8, border: '1px solid #ffc107' }}>
            <p style={{ margin: 0, fontSize: 13 }}>
              {reg.paymentStatus === 'rejected'
                ? '❌ Your payment was rejected. Please re-attempt payment or contact the organizer.'
                : reg.paymentProof
                  ? '⏳ Payment proof uploaded. Waiting for organizer approval. QR code will be generated after approval.'
                  : '⚠️ Please upload your payment proof below to complete your registration. QR code will be generated after approval.'}
            </p>
          </div>
        )}

        <div style={{ textAlign: 'left', padding: '16px 0', borderTop: '1px dashed var(--border-color)' }}>
          <p style={{ fontSize: 13, marginBottom: 6 }}><strong>Ticket ID:</strong> {reg.ticketId}</p>
          <p style={{ fontSize: 13, marginBottom: 6 }}><strong>Registered:</strong> {new Date(reg.registeredAt || reg.createdAt).toLocaleDateString()}</p>
          {/* Team info */}
          {reg.team && (
            <div style={{ padding: 10, background: 'var(--bg-secondary)', borderRadius: 6, marginBottom: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>🏆 Team: {reg.team.teamName}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {reg.team.isComplete ? '✅ Complete' : '⏳ Incomplete'} • {(reg.team.members?.filter(m => m.status === 'accepted').length || 0) + 1}/{reg.team.teamSize} members
              </p>
            </div>
          )}
          {reg.registrationType === 'merchandise' && reg.variantDetails && (
            <>
              <p style={{ fontSize: 13, marginBottom: 6 }}><strong>Variant:</strong> {reg.variantDetails.name} {reg.variantDetails.size && `(${reg.variantDetails.size})`}</p>
              <p style={{ fontSize: 13, marginBottom: 6 }}><strong>Quantity:</strong> {reg.quantity}</p>
              <p style={{ fontSize: 13, marginBottom: 6 }}><strong>Total:</strong> Rs.{reg.totalAmount}</p>
            </>
          )}
          {reg.paymentStatus && reg.paymentStatus !== 'not_required' && (
            <p style={{ fontSize: 13, marginBottom: 6 }}><strong>Payment:</strong> {reg.paymentStatus}</p>
          )}
          {/* Upload payment proof for merchandise orders */}
          {((reg.paymentStatus && reg.paymentStatus !== 'not_required') || (reg.totalAmount && reg.totalAmount > 0)) && (
            <div style={{ marginTop: 12 }}>
              {/* Show existing proof if uploaded */}
              {reg.paymentProof && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>📎 Uploaded Payment Proof:</p>
                  <img src={getUploadUrl(reg.paymentProof)} alt="Payment proof" style={{ maxWidth: 200, maxHeight: 150, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-color)', cursor: 'pointer' }}
                    onClick={() => window.open(getUploadUrl(reg.paymentProof), '_blank')} />
                </div>
              )}

              {/* Show upload control when payment is not yet approved */}
              {reg.paymentStatus !== 'approved' && reg.status !== 'cancelled' && (
                <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                    {reg.paymentProof ? '📤 Re-upload Payment Proof' : '📤 Upload Payment Proof'}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                    Upload a screenshot or photo of your payment receipt (JPG, PNG, PDF — max 5MB)
                  </p>
                  <input type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" disabled={!file || uploading} onClick={async () => {
                      if (!file) return toast.error('Select a file');
                      setUploading(true);
                      try {
                        await registrationService.uploadPaymentProof(reg._id, file);
                        toast.success('Payment proof uploaded! Awaiting organizer approval.');
                        const res = await registrationService.getRegistration(id);
                        setReg(res.registration);
                        setFile(null);
                      } catch (err) {
                        toast.error(err.response?.data?.message || 'Upload failed');
                      } finally { setUploading(false); }
                    }}>{uploading ? 'Uploading...' : '📤 Upload Proof'}</button>
                  </div>
                </div>
              )}

              {/* Show approved message */}
              {reg.paymentStatus === 'approved' && (
                <div style={{ padding: 12, background: 'rgba(16,185,129,0.1)', borderRadius: 8, border: '1px solid var(--success-color)' }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--success-color)' }}>✅ Payment approved! Your ticket and QR code are ready.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {(reg.status === 'confirmed' || reg.status === 'attended') && (
          <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px dashed var(--border-color)' }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>📅 Add to Calendar</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={handleDownloadICS}>
                ⬇ Download .ics
              </button>
              {(calendarLinks?.links?.google || calendarLinks?.googleCalendarUrl) && (
                <a href={calendarLinks.links?.google || calendarLinks.googleCalendarUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px', textDecoration: 'none' }}>
                  Google Calendar
                </a>
              )}
              {(calendarLinks?.links?.outlook || calendarLinks?.outlookCalendarUrl) && (
                <a href={calendarLinks.links?.outlook || calendarLinks.outlookCalendarUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px', textDecoration: 'none' }}>
                  Outlook Calendar
                </a>
              )}
            </div>
          </div>
        )}

        {(reg.status === 'confirmed' || reg.status === 'pending') && (
          <button className="btn btn-danger" style={{ marginTop: 12 }} onClick={handleCancel}>
            Cancel Registration
          </button>
        )}
      </div>
    </div>
  );
};

export default TicketPage;

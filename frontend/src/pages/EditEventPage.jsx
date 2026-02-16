import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import eventService from '../services/eventService';
import LoadingSpinner from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';

const EditEventPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [event, setEvent] = useState(null);
  const [form, setForm] = useState({});
  const [customFields, setCustomFields] = useState([]);
  const [variants, setVariants] = useState([]);

  useEffect(() => {
    eventService.getEvent(id).then(res => {
      const ev = res.event;
      setEvent(ev);
      setForm({
        name: ev.name || '',
        description: ev.description || '',
        registrationDeadline: ev.registrationDeadline ? new Date(ev.registrationDeadline).toISOString().slice(0, 16) : '',
        eventStartDate: ev.eventStartDate ? new Date(ev.eventStartDate).toISOString().slice(0, 16) : '',
        eventEndDate: ev.eventEndDate ? new Date(ev.eventEndDate).toISOString().slice(0, 16) : '',
        eligibility: ev.eligibility || 'all',
        registrationLimit: ev.registrationLimit || '',
        registrationFee: ev.registrationFee || 0,
        venue: ev.venue || '',
        tags: ev.tags?.join(', ') || '',
        isTeamEvent: ev.isTeamEvent || false,
        minTeamSize: ev.minTeamSize || 2,
        maxTeamSize: ev.maxTeamSize || 4,
      });
      setCustomFields(ev.customFields || []);
      setVariants(ev.variants?.map(v => ({ ...v, _id: v._id || crypto.randomUUID() })) || []);
    }).catch(() => {
      toast.error('Event not found');
      navigate('/dashboard');
    }).finally(() => setLoading(false));
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  // Custom field builder
  const addField = () => setCustomFields(f => [...f, {
    fieldId: 'field_' + Date.now(),
    type: 'text', label: '', placeholder: '', required: false, options: [], order: f.length
  }]);
  const updateField = (idx, key, val) => setCustomFields(f => f.map((fi, i) => i === idx ? { ...fi, [key]: val } : fi));
  const removeField = (idx) => setCustomFields(f => f.filter((_, i) => i !== idx));
  const moveField = (idx, dir) => setCustomFields(f => {
    const arr = [...f]; const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= arr.length) return arr;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    return arr.map((fi, i) => ({ ...fi, order: i }));
  });

  // Variant builder
  const addVariant = () => setVariants(v => [...v, { _id: crypto.randomUUID(), name: '', size: '', color: '', price: 0, stock: 0, sold: 0 }]);
  const updateVariant = (idx, key, val) => setVariants(v => v.map((vi, i) => i === idx ? { ...vi, [key]: val } : vi));
  const removeVariant = (idx) => setVariants(v => v.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (form.eventStartDate && form.eventEndDate) {
      const start = new Date(form.eventStartDate);
      const end = new Date(form.eventEndDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return toast.error('Please provide valid start and end dates');
      if (end <= start) return toast.error('Event end date must be after start date');
    }
    if (form.registrationDeadline && form.eventStartDate) {
      const reg = new Date(form.registrationDeadline);
      const start = new Date(form.eventStartDate);
      if (isNaN(reg.getTime()) || isNaN(start.getTime())) return toast.error('Please provide valid registration deadline and start date');
      if (reg >= start) return toast.error('Registration deadline must be before event start date');
    }

    setSaving(true);
    try {
      const data = {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        registrationLimit: form.registrationLimit ? Number(form.registrationLimit) : undefined,
        registrationFee: Number(form.registrationFee) || 0,
        customFields: event?.eventType !== 'merchandise' ? customFields : undefined,
        variants: event?.eventType === 'merchandise' ? variants : undefined,
      };
      await eventService.updateEvent(id, data);
      toast.success('Event updated');
      navigate(`/events/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    try {
      await eventService.publishEvent(id);
      toast.success('Event published!');
      navigate(`/events/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Publish failed');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this event?')) return;
    try {
      await eventService.deleteEvent(id);
      toast.success('Event deleted');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!event) return null;

  const isDraft = event.status === 'draft';
  const formLocked = event.formLocked;

  return (
    <div className="container" style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1>Edit Event</h1>
        <span className={`badge ${isDraft ? 'badge-warning' : 'badge-info'}`}>{event.status}</span>
      </div>

      {/* Basic Info */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16, fontSize: 16 }}>Basic Information</h3>
        <div className="form-group">
          <label>Event Name</label>
          <input name="name" className="form-control" value={form.name} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea name="description" className="form-control" value={form.description} onChange={handleChange} rows={4} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Start Date</label>
            <input name="eventStartDate" type="datetime-local" className="form-control" value={form.eventStartDate} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>End Date</label>
            <input name="eventEndDate" type="datetime-local" className="form-control" value={form.eventEndDate} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Registration Deadline</label>
            <input name="registrationDeadline" type="datetime-local" className="form-control" value={form.registrationDeadline} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Registration Limit</label>
            <input name="registrationLimit" type="number" className="form-control" value={form.registrationLimit} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Registration Fee</label>
            <input name="registrationFee" type="number" className="form-control" value={form.registrationFee} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Eligibility</label>
            <select name="eligibility" className="form-control" value={form.eligibility} onChange={handleChange}>
              <option value="all">Open to All</option>
              <option value="iiit-only">IIIT Only</option>
              <option value="non-iiit-only">Non-IIIT Only</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label>Venue</label>
          <input name="venue" className="form-control" value={form.venue} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Tags (comma-separated)</label>
          <input name="tags" className="form-control" value={form.tags} onChange={handleChange} />
        </div>

        {/* Team Event Settings */}
        {isDraft && (
          <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border-color)', borderRadius: 'var(--radius)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" name="isTeamEvent" checked={form.isTeamEvent} onChange={handleChange} />
              <strong>Team Event</strong>
            </label>
            {form.isTeamEvent && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div className="form-group">
                  <label>Min Team Size</label>
                  <input name="minTeamSize" type="number" className="form-control" min="2" value={form.minTeamSize} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Max Team Size</label>
                  <input name="maxTeamSize" type="number" className="form-control" min="2" value={form.maxTeamSize} onChange={handleChange} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Form Builder (normal events, draft only) */}
      {event.eventType !== 'merchandise' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16 }}>Custom Registration Form</h3>
            {formLocked && <span className="badge badge-warning" style={{ fontSize: 11 }}>🔒 Locked — registrations received</span>}
          </div>
          {formLocked ? (
            <p className="text-muted" style={{ fontSize: 13 }}>Form fields cannot be edited after the first registration.</p>
          ) : (
            <>
              {customFields.map((field, idx) => (
                <div key={field.fieldId} style={{ padding: 12, border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 20 }}>#{idx + 1}</span>
                    <select className="form-control" style={{ width: 130 }} value={field.type}
                      onChange={e => updateField(idx, 'type', e.target.value)}>
                      <option value="text">Text</option>
                      <option value="textarea">Textarea</option>
                      <option value="number">Number</option>
                      <option value="email">Email</option>
                      <option value="dropdown">Dropdown</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="radio">Radio</option>
                      <option value="file">File</option>
                    </select>
                    <input className="form-control" style={{ flex: 1 }} placeholder="Field label *"
                      value={field.label} onChange={e => updateField(idx, 'label', e.target.value)} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={field.required} onChange={e => updateField(idx, 'required', e.target.checked)} /> Req
                    </label>
                    <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: 12 }} onClick={() => moveField(idx, -1)}>↑</button>
                    <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: 12 }} onClick={() => moveField(idx, 1)}>↓</button>
                    <button className="btn btn-danger" style={{ padding: '2px 6px', fontSize: 12 }} onClick={() => removeField(idx)}>✕</button>
                  </div>
                  <input className="form-control" placeholder="Placeholder text" style={{ marginBottom: 4, fontSize: 13 }}
                    value={field.placeholder || ''} onChange={e => updateField(idx, 'placeholder', e.target.value)} />
                  {(field.type === 'dropdown' || field.type === 'radio') && (
                    <input className="form-control" placeholder="Options (comma-separated)" style={{ fontSize: 13 }}
                      value={Array.isArray(field.options) ? field.options.join(', ') : ''}
                      onChange={e => updateField(idx, 'options', e.target.value.split(',').map(o => o.trim()).filter(Boolean))} />
                  )}
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={addField}>+ Add Field</button>
            </>
          )}
        </div>
      )}

      {/* Merchandise Variants (merchandise events, draft only) */}
      {event.eventType === 'merchandise' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12, fontSize: 16 }}>Merchandise Variants</h3>
          {!isDraft ? (
            <p className="text-muted" style={{ fontSize: 13 }}>Variants can only be edited in draft status.</p>
          ) : (
            <>
              {variants.map((v, idx) => (
                <div key={v._id} style={{ padding: 12, border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', marginBottom: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px auto', gap: 8, alignItems: 'end' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 12 }}>Name</label>
                      <input className="form-control" value={v.name} onChange={e => updateVariant(idx, 'name', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 12 }}>Size</label>
                      <input className="form-control" value={v.size || ''} onChange={e => updateVariant(idx, 'size', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 12 }}>Color</label>
                      <input className="form-control" value={v.color || ''} onChange={e => updateVariant(idx, 'color', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 12 }}>Price ₹</label>
                      <input type="number" className="form-control" value={v.price} onChange={e => updateVariant(idx, 'price', Number(e.target.value))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 12 }}>Stock</label>
                      <input type="number" className="form-control" value={v.stock} onChange={e => updateVariant(idx, 'stock', Number(e.target.value))} />
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => removeVariant(idx)}>✕</button>
                  </div>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={addVariant}>+ Add Variant</button>
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {isDraft && (
          <button className="btn btn-success" onClick={handlePublish}>Publish</button>
        )}
        <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
      </div>
    </div>
  );
};

export default EditEventPage;

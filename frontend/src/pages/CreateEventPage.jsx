import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import eventService from '../services/eventService';
import toast from 'react-hot-toast';

const CreateEventPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', eventType: 'normal',
    registrationDeadline: '', eventStartDate: '', eventEndDate: '',
    eligibility: 'all', registrationLimit: '', registrationFee: 0,
    venue: '', tags: '', isTeamEvent: false, minTeamSize: 2, maxTeamSize: 4,
  });
  const [customFields, setCustomFields] = useState([]);
  const [variants, setVariants] = useState([]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const addCustomField = () => {
    setCustomFields(prev => [...prev, {
      fieldId: `field_${Date.now()}`, type: 'text', label: '', placeholder: '',
      required: false, options: [], order: prev.length
    }]);
  };

  const updateField = (idx, key, val) => {
    setCustomFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: val } : f));
  };

  const removeField = (idx) => setCustomFields(prev => prev.filter((_, i) => i !== idx));

  const moveField = (idx, direction) => {
    setCustomFields(prev => {
      const arr = [...prev];
      const target = idx + direction;
      if (target < 0 || target >= arr.length) return arr;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr.map((f, i) => ({ ...f, order: i }));
    });
  };

  const addVariant = () => {
    setVariants(prev => [...prev, { name: '', size: '', color: '', price: 0, stock: 0 }]);
  };

  const updateVariant = (idx, key, val) => {
    setVariants(prev => prev.map((v, i) => i === idx ? { ...v, [key]: val } : v));
  };

  const removeVariant = (idx) => setVariants(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (publish = false) => {
    if (!form.name) return toast.error('Event name is required');
    if (!form.description) return toast.error('Description is required');
    // Business rules: validate dates
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

    setLoading(true);
    try {
      const data = {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        registrationLimit: form.registrationLimit ? Number(form.registrationLimit) : undefined,
        registrationFee: Number(form.registrationFee) || 0,
        customFields: customFields.length > 0 ? customFields : undefined,
      };
      if (form.eventType === 'merchandise') {
        data.variants = variants;
      }

      const res = await eventService.createEvent(data);
      const eventId = res.event._id;

      if (publish) {
        await eventService.publishEvent(eventId);
        toast.success('Event published!');
      } else {
        toast.success('Event saved as draft');
      }
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 800 }}>
      <h1 style={{ marginBottom: 24 }}>Create Event</h1>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16 }}>Basic Info</h3>
        <div className="form-group">
          <label>Event Name *</label>
          <input name="name" className="form-control" value={form.name} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Description *</label>
          <textarea name="description" className="form-control" value={form.description} onChange={handleChange} rows={4} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Event Type</label>
            <select name="eventType" className="form-control" value={form.eventType} onChange={handleChange}>
              <option value="normal">Normal Event</option>
              <option value="merchandise">Merchandise</option>
            </select>
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
          <label>Tags (comma-separated)</label>
          <input name="tags" className="form-control" value={form.tags} onChange={handleChange}
            placeholder="technical, coding, hackathon" />
        </div>
        <div className="form-group">
          <label>Venue</label>
          <input name="venue" className="form-control" value={form.venue} onChange={handleChange} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16 }}>Schedule & Limits</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Start Date *</label>
            <input name="eventStartDate" type="datetime-local" className="form-control"
              value={form.eventStartDate} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>End Date</label>
            <input name="eventEndDate" type="datetime-local" className="form-control"
              value={form.eventEndDate} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Registration Deadline *</label>
            <input name="registrationDeadline" type="datetime-local" className="form-control"
              value={form.registrationDeadline} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Registration Limit</label>
            <input name="registrationLimit" type="number" className="form-control"
              value={form.registrationLimit} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Registration Fee (Rs.)</label>
            <input name="registrationFee" type="number" className="form-control"
              value={form.registrationFee} onChange={handleChange} />
          </div>
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" name="isTeamEvent" checked={form.isTeamEvent} onChange={handleChange} />
            Team Event
          </label>
        </div>
        {form.isTeamEvent && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Min Team Size</label>
              <input name="minTeamSize" type="number" className="form-control"
                value={form.minTeamSize} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Max Team Size</label>
              <input name="maxTeamSize" type="number" className="form-control"
                value={form.maxTeamSize} onChange={handleChange} />
            </div>
          </div>
        )}
      </div>

      {/* Custom Form Builder */}
      {form.eventType === 'normal' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>Custom Registration Form</h3>
            <button className="btn btn-secondary btn-sm" onClick={addCustomField}>+ Add Field</button>
          </div>
          {customFields.length === 0 && <p className="text-muted" style={{ fontSize: 13 }}>No custom fields added. Default registration will be used.</p>}
          {customFields.map((field, idx) => (
            <div key={idx} style={{ padding: 12, border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto', gap: 8, alignItems: 'end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Label</label>
                  <input className="form-control" value={field.label}
                    onChange={e => updateField(idx, 'label', e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Type</label>
                  <select className="form-control" value={field.type}
                    onChange={e => updateField(idx, 'type', e.target.value)}>
                    <option value="text">Text</option>
                    <option value="textarea">Textarea</option>
                    <option value="number">Number</option>
                    <option value="email">Email</option>
                    <option value="select">Dropdown</option>
                    <option value="checkbox">Checkbox</option>
                    <option value="radio">Radio</option>
                    <option value="file">File Upload</option>
                  </select>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => moveField(idx, -1)} disabled={idx === 0} title="Move Up">↑</button>
                <button className="btn btn-secondary btn-sm" onClick={() => moveField(idx, 1)} disabled={idx === customFields.length - 1} title="Move Down">↓</button>
                <button className="btn btn-danger btn-sm" onClick={() => removeField(idx)}>Remove</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                <input className="form-control" style={{ flex: 1 }} placeholder="Placeholder"
                  value={field.placeholder} onChange={e => updateField(idx, 'placeholder', e.target.value)} />
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={field.required}
                    onChange={e => updateField(idx, 'required', e.target.checked)} /> Required
                </label>
              </div>
              {(field.type === 'select' || field.type === 'radio') && (
                <div className="form-group" style={{ marginTop: 8, marginBottom: 0 }}>
                  <label>Options (comma-separated)</label>
                  <input className="form-control" value={field.options?.join(', ') || ''}
                    onChange={e => updateField(idx, 'options', e.target.value.split(',').map(o => o.trim()))} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Merchandise Variants */}
      {form.eventType === 'merchandise' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>Variants</h3>
            <button className="btn btn-secondary btn-sm" onClick={addVariant}>+ Add Variant</button>
          </div>
          {variants.map((v, idx) => (
            <div key={idx} style={{ padding: 12, border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', marginBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Name</label>
                  <input className="form-control" value={v.name} onChange={e => updateVariant(idx, 'name', e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Size</label>
                  <input className="form-control" value={v.size} onChange={e => updateVariant(idx, 'size', e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Color</label>
                  <input className="form-control" value={v.color} onChange={e => updateVariant(idx, 'color', e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Price</label>
                  <input type="number" className="form-control" value={v.price} onChange={e => updateVariant(idx, 'price', Number(e.target.value))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Stock</label>
                  <input type="number" className="form-control" value={v.stock} onChange={e => updateVariant(idx, 'stock', Number(e.target.value))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'end' }}>
                  <button className="btn btn-danger btn-sm" onClick={() => removeVariant(idx)}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn-secondary btn-lg" onClick={() => handleSubmit(false)} disabled={loading}>
          Save as Draft
        </button>
        <button className="btn btn-primary btn-lg" onClick={() => handleSubmit(true)} disabled={loading}>
          {loading ? 'Creating...' : 'Publish Event'}
        </button>
      </div>
    </div>
  );
};

export default CreateEventPage;

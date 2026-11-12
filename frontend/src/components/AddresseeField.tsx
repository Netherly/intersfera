import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getApiError } from '@/lib/format';
import { Spinner } from '@/components/Spinner';

interface AddresseeOption {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
}

export function AddresseeField({
  value,
  email,
  onChange,
  onEmailChange,
  disabled,
}: {
  value: string;
  email: string;
  onChange: (value: string) => void;
  onEmailChange: (email: string) => void;
  disabled?: boolean;
}) {
  const [options, setOptions] = useState<AddresseeOption[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<AddresseeOption[]>('/addressees')
      .then((res) => setOptions(res.data.filter((item) => item.is_active)))
      .catch(() => setOptions([]));
  }, []);

  const query = value.trim().toLowerCase();
  const matches = options.filter((item) => item.name.toLowerCase().includes(query)).slice(0, 8);

  function pick(item: AddresseeOption) {
    onChange(item.name);
    onEmailChange(item.email);
    setOpen(false);
    setNote('');
    setError('');
  }

  async function saveDirectory() {
    const name = value.trim();
    if (!name || disabled) return;
    setSaving(true);
    setOpen(false);
    setError('');
    setNote('');
    try {
      const res = await api.post<AddresseeOption>('/addressees', { name, email: email.trim() });
      setOptions((prev) => {
        const rest = prev.filter((item) => item.id !== res.data.id);
        return [...rest, res.data].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      });
      onChange(res.data.name);
      onEmailChange(res.data.email);
      setNote('Адресат и почта сохранены в справочник.');
    } catch (err) {
      setError(getApiError(err, 'Не удалось сохранить адресата'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="addressee-field">
      <div className="combo">
        <input
          className="input"
          value={value}
          disabled={disabled}
          placeholder="Название"
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setNote('');
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150);
          }}
        />
        {open && !disabled && matches.length > 0 && (
          <ul className="combo__list">
            {matches.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="combo__option"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(item)}
                >
                  <span>{item.name}</span>
                  {item.email && <span className="combo__meta">{item.email}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <label className="field__label addressee-field__label">Почта</label>
      <input
        className="input"
        type="email"
        value={email}
        disabled={disabled}
        placeholder="name@mail.ru"
        onChange={(e) => {
          onEmailChange(e.target.value);
          setNote('');
        }}
      />
      <div className="addressee-field__save">
        <button className="btn btn--sm" type="button" onClick={saveDirectory} disabled={disabled || saving || !value.trim()}>
          {saving ? <Spinner label="Сохранение…" /> : 'Сохранить в справочник'}
        </button>
      </div>
      <div className="field__hint">
        Выбор из списка подставляет почту. Её можно поправить для этого письма. В справочник запись попадает только по кнопке.
      </div>
      {note && <div className="field__hint">{note}</div>}
      {error && <div className="form-error">{error}</div>}
    </div>
  );
}

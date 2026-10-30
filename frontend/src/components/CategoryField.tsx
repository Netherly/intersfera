import { useEffect, useState } from 'react';

const CUSTOM = '__custom__';

interface CategoryOption {
  id: number;
  name: string;
}

export function CategoryField({
  value,
  categories,
  disabled,
  onChange,
}: {
  value: string;
  categories: CategoryOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const names = categories.map((item) => item.name);
  const listKey = names.join('\u0001');
  const [custom, setCustom] = useState(value !== '' && !names.includes(value));

  useEffect(() => {
    const list = listKey ? listKey.split('\u0001') : [];
    if (list.includes(value)) setCustom(false);
    else if (value !== '') setCustom(true);
  }, [value, listKey]);

  return (
    <>
      <select
        className="select"
        value={custom ? CUSTOM : value}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value;
          if (next === CUSTOM) {
            setCustom(true);
            if (names.includes(value)) onChange('');
            return;
          }
          setCustom(false);
          onChange(next);
        }}
      >
        <option value="">Не указана</option>
        {categories.map((item) => (
          <option key={item.id} value={item.name}>
            {item.name}
          </option>
        ))}
        <option value={CUSTOM}>Своя категория</option>
      </select>
      {custom && (
        <input
          className="input"
          value={value}
          disabled={disabled}
          placeholder="Введите название"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </>
  );
}

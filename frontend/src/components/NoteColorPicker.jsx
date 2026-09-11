import { NOTE_COLORS, noteColorStyle } from '../lib/noteColors.js';

export default function NoteColorPicker({ value, onChange, disabled = false }) {
  return (
    <fieldset className="note-color-field" disabled={disabled}>
      <legend>Cor da nota</legend>
      <div className="note-color-options">
        {NOTE_COLORS.map((color) => (
          <label className="note-color-option" key={color.value}>
            <input
              type="radio"
              name="note-color"
              value={color.value}
              checked={value === color.value}
              onChange={() => onChange(color.value)}
            />
            <span
              className="note-color-swatch"
              style={{ background: color.background, borderColor: color.border }}
              aria-hidden="true"
            >
              {value === color.value && '✓'}
            </span>
            <span className="note-color-name">{color.label}</span>
          </label>
        ))}
      </div>
      <div className="note-color-preview note-colored" style={noteColorStyle(value)} aria-hidden="true">
        Prévia da cor do bloco
      </div>
    </fieldset>
  );
}

import { PAGE_THEMES, type PageTheme } from '@internal/core/types/Page';
import { BIO_THEMES } from './themes';

export function ThemePicker({
  value,
  onChange,
}: {
  value: PageTheme;
  onChange: (theme: PageTheme) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Theme">
      <p className="mb-2 text-sm font-medium">Theme</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {PAGE_THEMES.map(theme => {
          const preset = BIO_THEMES[theme];
          const selected = theme === value;
          return (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(theme)}
              className={`rounded-lg border-2 p-1 text-xs font-medium transition-colors ${
                selected
                  ? 'border-primary'
                  : 'border-transparent hover:border-border'
              }`}
            >
              <span
                className={`flex h-14 flex-col items-center justify-center gap-1 rounded-md ${preset.swatch}`}
              >
                <span className={`h-2 w-10 rounded-full ${preset.button}`} />
                <span className={`h-2 w-10 rounded-full ${preset.button}`} />
              </span>
              <span className="mt-1 block">{preset.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

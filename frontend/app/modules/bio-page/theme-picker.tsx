import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import type pagesEn from '../../i18n/en/pages.json';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import {
  getColorPalettesKey,
  useGetColorPalettes,
} from '@internal/core/actions/get-color-palettes/get-color-palettes.hook';
import { useCreateColorPalette } from '@internal/core/actions/create-color-palette/create-color-palette.hook';
import { useDeleteColorPalette } from '@internal/core/actions/delete-color-palette/delete-color-palette.hook';
import {
  PAGE_THEMES,
  type CustomColors,
  type PageTheme,
} from '@internal/core/types/Page';
import { BIO_THEMES, contrastRatio, customTheme } from './themes';

const STARTING_COLORS: CustomColors = {
  background: '#0f172a',
  text: '#f8fafc',
  accent: '#6366f1',
};

type PagesKey = keyof typeof pagesEn;

const COLOR_LABELS: Record<keyof CustomColors, PagesKey> = {
  background: 'color_background',
  text: 'color_text',
  accent: 'color_buttons',
};

const THEME_NAMES: Record<PageTheme, PagesKey> = {
  default: 'theme_default',
  midnight: 'theme_midnight',
  sunset: 'theme_sunset',
  forest: 'theme_forest',
  ocean: 'theme_ocean',
  paper: 'theme_paper',
};

export function ThemePicker({
  value,
  colors,
  onChange,
  onColorsChange,
}: {
  value: PageTheme;
  colors: CustomColors | null | undefined;
  onChange: (theme: PageTheme) => void;
  onColorsChange: (colors: CustomColors | null) => void;
}) {
  const { t } = useTranslation('pages');
  const tile = (selected: boolean) =>
    `rounded-lg border-2 p-1 text-xs font-medium transition-colors ${
      selected ? 'border-primary' : 'border-transparent hover:border-border'
    }`;
  const queryClient = useQueryClient();
  const [paletteName, setPaletteName] = useState('');
  const { data: palettes = [] } = useGetColorPalettes();
  const refreshPalettes = () =>
    queryClient.invalidateQueries({ queryKey: getColorPalettesKey });
  const showError = (error: { errors?: unknown }) =>
    notifications.show({
      message: Array.isArray(error?.errors)
        ? error.errors.join(', ')
        : i18n.t('pages:palette_error'),
      color: 'red',
    });
  const { mutate: savePalette, isPending: isSaving } = useCreateColorPalette({
    onSuccess: () => {
      setPaletteName('');
      refreshPalettes();
    },
    onError: showError,
  });
  const { mutate: removePalette } = useDeleteColorPalette({
    onSuccess: refreshPalettes,
    onError: showError,
  });
  const custom = customTheme(colors ?? STARTING_COLORS);
  const unreadable = colors && contrastRatio(colors.text, colors.background) < 4.5;

  return (
    <div role="radiogroup" aria-label={t('theme_label')}>
      <p className="mb-2 text-sm font-medium">{t('theme_label')}</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
        {PAGE_THEMES.map(theme => {
          const preset = BIO_THEMES[theme];
          return (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={!colors && theme === value}
              onClick={() => {
                onColorsChange(null);
                onChange(theme);
              }}
              className={tile(!colors && theme === value)}
            >
              <span
                className={`flex h-14 flex-col items-center justify-center gap-1 rounded-md ${preset.swatch}`}
              >
                <span className={`h-2 w-10 rounded-full ${preset.button}`} />
                <span className={`h-2 w-10 rounded-full ${preset.button}`} />
              </span>
              <span className="mt-1 block">{t(THEME_NAMES[theme])}</span>
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={!!colors}
          onClick={() => onColorsChange(colors ?? STARTING_COLORS)}
          className={tile(!!colors)}
        >
          <span
            style={custom.style}
            className={`flex h-14 flex-col items-center justify-center gap-1 rounded-md border border-border ${custom.swatch}`}
          >
            <span className={`h-2 w-10 rounded-full ${custom.button}`} />
            <span className={`h-2 w-10 rounded-full ${custom.button}`} />
          </span>
          <span className="mt-1 block">{t('theme_custom')}</span>
        </button>
      </div>

      {colors && (
        <div className="mt-3 flex flex-wrap gap-4">
          {(Object.keys(COLOR_LABELS) as (keyof CustomColors)[]).map(key => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="color"
                value={colors[key]}
                onChange={event =>
                  onColorsChange({ ...colors, [key]: event.target.value })
                }
                className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
              />
              {t(COLOR_LABELS[key])}
            </label>
          ))}
          <div className="flex w-full items-center gap-2">
            <input
              type="text"
              value={paletteName}
              maxLength={40}
              placeholder={t('palette_name_placeholder')}
              aria-label={t('palette_name_label')}
              onChange={event => setPaletteName(event.target.value)}
              className="h-9 min-w-0 flex-1 rounded-md border border-border bg-transparent px-3 text-sm"
            />
            <button
              type="button"
              disabled={!paletteName.trim() || isSaving}
              onClick={() =>
                savePalette({ name: paletteName.trim(), custom_colors: colors })
              }
              className="h-9 rounded-md border border-border px-3 text-sm font-medium disabled:opacity-50"
            >
              {t('palette_save')}
            </button>
          </div>
          {unreadable && (
            <p role="status" className="w-full text-xs text-amber-600">
              {t('palette_unreadable')}
            </p>
          )}
        </div>
      )}

      {palettes.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-sm font-medium">{t('palettes_title')}</p>
          <ul className="flex flex-wrap gap-2">
            {palettes.map(palette => {
              const saved = customTheme(palette.custom_colors);
              return (
                <li
                  key={palette.id}
                  className="flex items-center rounded-full border border-border text-xs"
                >
                  <button
                    type="button"
                    onClick={() => onColorsChange(palette.custom_colors)}
                    className="flex items-center gap-2 py-1 pr-2 pl-1"
                  >
                    <span
                      style={saved.style}
                      className={`h-5 w-5 rounded-full border border-border ${saved.avatar}`}
                    />
                    {palette.name}
                  </button>
                  <button
                    type="button"
                    aria-label={t('palette_delete', { name: palette.name })}
                    onClick={() => removePalette(palette.id)}
                    className="py-1 pr-2 pl-1 text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import en_overrides from './en_overrides';

export type TFn = (cs: string, vars?: Record<string, string | number>) => string;

export function useT(): TFn {
  const { i18n } = useTranslation();
  return (cs, vars) => {
    const tpl = i18n.language === 'en' ? (en_overrides[cs] ?? cs) : cs;
    if (!vars) return tpl;
    return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
  };
}

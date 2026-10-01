// U8: validation messages are user-readable, in the active locale.
// Tiny i18n helper — bn (Bangla) ships with Phase 1.
type Locale = 'en' | 'bn'

const DICT: Record<Locale, Record<string, string>> = {
  en: {
    'app.title': 'NeuroBook',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'voucher.save': 'Save draft',
    'voucher.post': 'Post',
    'voucher.reverse': 'Reverse',
    'sync.pending': '{n} pending',
    'sync.idle': 'Synced',
    'sync.retry': 'Sync now',
    'error.network': 'No connection.',
    'error.post_offline': 'Posting requires connectivity.',
    'error.unbalanced': 'Debits and credits do not match.',
  },
  bn: {
    'app.title': 'নিউরোবুক',
    'login.email': 'ইমেইল',
    'login.password': 'পাসওয়ার্ড',
    'login.submit': 'সাইন ইন',
    'voucher.save': 'খসড়া সংরক্ষণ',
    'voucher.post': 'পোস্ট',
    'voucher.reverse': 'বিপরীত',
    'sync.pending': '{n} বাকি',
    'sync.idle': 'সিঙ্ক হয়েছে',
    'sync.retry': 'এখনই সিঙ্ক',
    'error.network': 'সংযোগ নেই।',
    'error.post_offline': 'পোস্ট করতে সংযোগ প্রয়োজন।',
    'error.unbalanced': 'ডেবিট ও ক্রেডিট সমান নয়।',
  },
}

let current: Locale = 'en'

export function setLocale(l: Locale) { current = l }
export function getLocale(): Locale { return current }
export function t(key: string, vars: Record<string, string | number> = {}): string {
  const s = DICT[current][key] ?? key
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

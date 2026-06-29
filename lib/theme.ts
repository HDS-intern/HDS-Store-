export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'hds-theme'

/** Default site theme: white / light mode */
export const DEFAULT_THEME: Theme = 'light'

/** Admin area always uses dark mode */
export const ADMIN_DEFAULT_THEME: Theme = 'dark'

export function isAdminDashboard(pathname: string): boolean {
  return pathname.startsWith('/admin')
}

export function isAdminLoginPage(pathname: string, search = ''): boolean {
  if (pathname !== '/login') return false
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return params.get('admin') === '1'
}

export function isAdminArea(pathname: string, search = ''): boolean {
  return isAdminDashboard(pathname) || isAdminLoginPage(pathname, search)
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
  } else {
    root.classList.remove('dark')
    root.style.colorScheme = 'light'
  }
}

export function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'dark') return 'dark'
    if (stored === 'light') return 'light'
    return DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function getThemeFromDocument(): Theme {
  if (typeof document === 'undefined') return DEFAULT_THEME
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export const themeInitScript = `(function(){try{var root=document.documentElement;var path=location.pathname;var search=location.search||'';var isAdminDashboard=path.indexOf('/admin')===0;if(isAdminDashboard){root.classList.add('dark');root.style.colorScheme='dark';return;}var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='dark'){root.classList.add('dark');root.style.colorScheme='dark';}else{root.classList.remove('dark');root.style.colorScheme='light';if(!t)localStorage.setItem('${THEME_STORAGE_KEY}','light');}}catch(e){}})();`

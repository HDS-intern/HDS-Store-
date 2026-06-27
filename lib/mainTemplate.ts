import { queryOne, execute } from './db'
import { DEFAULT_MAIN_TEMPLATE, type MainTemplate } from './mainTemplateTypes'

export type {
  PopupType,
  HomeSlide,
  HomeHero,
  HomePopup,
  MainTemplate,
} from './mainTemplateTypes'

export { DEFAULT_MAIN_TEMPLATE, createSlideId } from './mainTemplateTypes'

const SETTING_KEY = 'main_template'

export async function getMainTemplate(): Promise<MainTemplate> {
  const row = await queryOne<{ data: string }>(
    'SELECT data FROM site_settings WHERE key = ?',
    [SETTING_KEY]
  )

  if (!row) return DEFAULT_MAIN_TEMPLATE

  try {
    const parsed = JSON.parse(row.data) as Partial<MainTemplate>
    return {
      slides: parsed.slides?.length ? parsed.slides : DEFAULT_MAIN_TEMPLATE.slides,
      hero: { ...DEFAULT_MAIN_TEMPLATE.hero, ...parsed.hero },
      popup: { ...DEFAULT_MAIN_TEMPLATE.popup, ...parsed.popup },
    }
  } catch {
    return DEFAULT_MAIN_TEMPLATE
  }
}

export async function saveMainTemplate(template: MainTemplate): Promise<void> {
  const now = new Date().toISOString()
  await execute(
    `INSERT INTO site_settings (key, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    [SETTING_KEY, JSON.stringify(template), now]
  )
}

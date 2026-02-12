import type { WebClient } from '@slack/web-api';
import type { Messages, MessageKey, SupportedLocale } from './types';
import ja from './locales/ja';
import en from './locales/en';
import hi from './locales/hi';
import fr from './locales/fr';
import es from './locales/es';
import zh from './locales/zh';
import ko from './locales/ko';

export type { Messages, MessageKey, SupportedLocale } from './types';

/** 全localeのメッセージマップ */
const messages: Record<SupportedLocale, Messages> = { ja, en, hi, fr, es, zh, ko };

/** デフォルトlocale */
const DEFAULT_LOCALE: SupportedLocale = 'ja';

/** サポートされているlocale一覧 */
const SUPPORTED_LOCALES = new Set<string>(['ja', 'en', 'hi', 'fr', 'es', 'zh', 'ko']);

/**
 * 翻訳関数
 * プレースホルダー `{{key}}` をparamsの値で補間する
 */
export function t(
  locale: SupportedLocale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const template = messages[locale]?.[key] ?? messages[DEFAULT_LOCALE][key];

  if (!params) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    return params[name] !== undefined ? String(params[name]) : `{{${name}}}`;
  });
}

/** localeキャッシュ: userId → { locale, expiresAt } */
const localeCache = new Map<string, { locale: SupportedLocale; expiresAt: number }>();

/** キャッシュTTL: 30分 */
const CACHE_TTL_MS = 30 * 60 * 1000;

/** キャッシュサイズ上限 */
const MAX_CACHE_SIZE = 1000;

/** 期限切れエントリをスイープ */
function sweepExpiredLocaleCache(): void {
  const now = Date.now();
  for (const [key, value] of localeCache) {
    if (value.expiresAt <= now) {
      localeCache.delete(key);
    }
  }
}

/**
 * Slack users.info API からユーザーのlocaleを取得する
 * 30分間インメモリキャッシュ
 */
export async function getUserLocale(client: WebClient, userId: string): Promise<SupportedLocale> {
  // キャッシュチェック
  const cached = localeCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.locale;
  }

  // サイズ上限到達時にスイープ
  if (localeCache.size >= MAX_CACHE_SIZE) {
    sweepExpiredLocaleCache();
  }

  try {
    const result = await (client as any).users.info({
      user: userId,
      include_locale: true,
    });

    const slackLocale: string = result.user?.locale ?? '';
    const locale = resolveLocale(slackLocale);

    // キャッシュに保存
    localeCache.set(userId, {
      locale,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return locale;
  } catch {
    // API失敗時はデフォルトlocaleを返す
    return DEFAULT_LOCALE;
  }
}

/**
 * Slack locale文字列（例: "en-US", "ja-JP"）を SupportedLocale に変換
 */
/** テスト用: localeキャッシュをクリア */
export function _clearLocaleCacheForTest(): void {
  localeCache.clear();
}

export function resolveLocale(slackLocale: string): SupportedLocale {
  if (!slackLocale) return DEFAULT_LOCALE;

  // "en-US" → "en" のように言語コード部分を抽出
  const lang = slackLocale.split('-')[0].toLowerCase();

  if (SUPPORTED_LOCALES.has(lang)) {
    return lang as SupportedLocale;
  }

  // 中国語の地域バリアント対応
  if (slackLocale.startsWith('zh')) {
    return 'zh';
  }

  return DEFAULT_LOCALE;
}

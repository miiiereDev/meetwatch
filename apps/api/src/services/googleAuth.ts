import type { Env } from '../env.js';
import type { SettingRepo } from '../repositories/settings.js';

const REFRESH_KEY = 'google_refresh_token';
const ACCESS_KEY = 'google_access_token';
const EXPIRY_KEY = 'google_token_expiry';

/** Meet read-only scopes; nothing writable is requested. */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/meetings.space.readonly',
  'https://www.googleapis.com/auth/conferenceRecords.readonly',
];

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Minimal OAuth 2.0 (authorization code + refresh) helper for the Google
 * Meet API. Tokens are stored in the settings table — appropriate for a
 * single-user, local school tool (see docs/GOOGLE_SETUP.md).
 */
export class GoogleAuthService {
  constructor(
    private readonly env: Env,
    private readonly settings: SettingRepo,
    private readonly fetchFn: FetchLike = fetch,
  ) {}

  configured(): boolean {
    return Boolean(this.env.GOOGLE_CLIENT_ID && this.env.GOOGLE_CLIENT_SECRET);
  }

  /** True once a refresh token has been stored by the OAuth callback. */
  connected(): boolean {
    const token = this.settings.get(REFRESH_KEY);
    return token !== null && token !== '';
  }

  /** The consent screen URL the user must open to connect an account. */
  authUrl(): string {
    if (!this.configured()) {
      throw new Error('Google OAuth is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)');
    }
    const params = new URLSearchParams({
      client_id: this.env.GOOGLE_CLIENT_ID,
      redirect_uri: this.env.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: GOOGLE_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /** Exchanges the callback's ?code for tokens and persists them. */
  async exchangeCode(code: string): Promise<void> {
    const body = new URLSearchParams({
      code,
      client_id: this.env.GOOGLE_CLIENT_ID,
      client_secret: this.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: this.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    });
    const tokens = await this.requestTokens(body);
    if (!tokens.access_token) {
      throw new Error(
        `token exchange failed: ${tokens.error_description ?? tokens.error ?? 'no access token'}`,
      );
    }
    // Google reuses the first refresh token on later consents; keep the old
    // one when the response omits it.
    const refreshToken = tokens.refresh_token ?? this.settings.get(REFRESH_KEY);
    if (refreshToken) this.settings.set(REFRESH_KEY, refreshToken);
    this.storeAccess(tokens.access_token, tokens.expires_in ?? 3600);
  }

  /** A valid access token, refreshing it first when expired. */
  async getAccessToken(): Promise<string> {
    const refresh = this.settings.get(REFRESH_KEY);
    if (!refresh) throw new Error('no Google refresh token stored — connect an account first');

    const expiry = Number(this.settings.get(EXPIRY_KEY) ?? 0);
    const access = this.settings.get(ACCESS_KEY);
    if (access && Date.now() < expiry - 60_000) return access;

    const tokens = await this.requestTokens(
      new URLSearchParams({
        refresh_token: refresh,
        client_id: this.env.GOOGLE_CLIENT_ID,
        client_secret: this.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    );
    if (!tokens.access_token) {
      throw new Error(
        `token refresh failed: ${tokens.error_description ?? tokens.error ?? 'no access token'}`,
      );
    }
    this.storeAccess(tokens.access_token, tokens.expires_in ?? 3600);
    return tokens.access_token;
  }

  /** Forgets stored tokens (used by tests and future disconnect flows). */
  disconnect(): void {
    this.settings.set(REFRESH_KEY, '');
    this.settings.set(ACCESS_KEY, '');
    this.settings.set(EXPIRY_KEY, '');
  }

  private storeAccess(accessToken: string, expiresIn: number): void {
    this.settings.set(ACCESS_KEY, accessToken);
    this.settings.set(EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
  }

  private async requestTokens(body: URLSearchParams): Promise<TokenResponse> {
    let res: Response;
    try {
      res = await this.fetchFn(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (err) {
      throw new Error(
        `cannot reach Google token endpoint: ${err instanceof Error ? err.message : err}`,
      );
    }
    const json = (await res.json().catch(() => ({}))) as TokenResponse;
    if (!res.ok) {
      throw new Error(
        `token request failed (${res.status}): ${json.error_description ?? json.error ?? res.statusText}`,
      );
    }
    return json;
  }
}

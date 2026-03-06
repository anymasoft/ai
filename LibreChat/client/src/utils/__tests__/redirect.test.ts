import {
  isSafeRedirect,
  buildLoginRedirectUrl,
  getPostLoginRedirect,
  persistRedirectToSession,
  SESSION_KEY,
} from '../redirect';

describe('isSafeRedirect', () => {
  it('accepts a simple relative path', () => {
    expect(isSafeRedirect('/c/new')).toBe(true);
  });

  it('accepts a path with query params and hash', () => {
    expect(isSafeRedirect('/c/new?q=hello&submit=true#section')).toBe(true);
  });

  it('accepts a nested path', () => {
    expect(isSafeRedirect('/dashboard/settings/profile')).toBe(true);
  });

  it('rejects an absolute http URL', () => {
    expect(isSafeRedirect('https://evil.com')).toBe(false);
  });

  it('rejects an absolute http URL with path', () => {
    expect(isSafeRedirect('https://evil.com/phishing')).toBe(false);
  });

  it('rejects a protocol-relative URL', () => {
    expect(isSafeRedirect('//evil.com')).toBe(false);
  });

  it('rejects a bare domain', () => {
    expect(isSafeRedirect('evil.com')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isSafeRedirect('')).toBe(false);
  });

  it('rejects /sign-in to prevent redirect loops', () => {
    expect(isSafeRedirect('/sign-in')).toBe(false);
  });

  it('rejects /sign-in with query params', () => {
    expect(isSafeRedirect('/sign-in?redirect_to=/c/new')).toBe(false);
  });

  it('rejects /sign-in sub-paths', () => {
    expect(isSafeRedirect('/sign-in/2fa')).toBe(false);
  });

  it('rejects /sign-in with hash', () => {
    expect(isSafeRedirect('/sign-in#foo')).toBe(false);
  });

  it('accepts the root path', () => {
    expect(isSafeRedirect('/')).toBe(true);
  });
});

describe('buildLoginRedirectUrl', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/c/abc123', search: '?model=gpt-4', hash: '#msg-5' },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  it('builds a login URL from explicit args', () => {
    const result = buildLoginRedirectUrl('/c/new', '?q=hello', '');
    expect(result).toBe('/sign-in?redirect_to=%2Fc%2Fnew%3Fq%3Dhello');
  });

  it('encodes complex paths with query and hash', () => {
    const result = buildLoginRedirectUrl('/c/new', '?q=hello&submit=true', '#section');
    expect(result).toContain('redirect_to=');
    const encoded = result.split('redirect_to=')[1];
    expect(decodeURIComponent(encoded)).toBe('/c/new?q=hello&submit=true#section');
  });

  it('falls back to window.location when no args provided', () => {
    const result = buildLoginRedirectUrl();
    const encoded = result.split('redirect_to=')[1];
    expect(decodeURIComponent(encoded)).toBe('/c/abc123?model=gpt-4#msg-5');
  });

  it('falls back to "/" when all location parts are empty', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '', search: '', hash: '' },
      writable: true,
    });
    const result = buildLoginRedirectUrl();
    expect(result).toBe('/sign-in?redirect_to=%2F');
  });

  it('returns plain /sign-in when pathname is /sign-in (prevents recursive redirect)', () => {
    const result = buildLoginRedirectUrl('/sign-in', '?redirect_to=%2Fc%2Fnew', '');
    expect(result).toBe('/sign-in');
  });

  it('returns plain /sign-in when window.location is already /sign-in', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/sign-in', search: '?redirect_to=%2Fc%2Fabc', hash: '' },
      writable: true,
    });
    const result = buildLoginRedirectUrl();
    expect(result).toBe('/sign-in');
  });

  it('returns plain /sign-in for /sign-in sub-paths', () => {
    const result = buildLoginRedirectUrl('/sign-in/2fa', '', '');
    expect(result).toBe('/sign-in');
  });

  it('returns plain /sign-in for basename-prefixed /sign-in (e.g. /librechat/sign-in)', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/librechat/sign-in', search: '?redirect_to=%2Fc%2Fabc', hash: '' },
      writable: true,
    });
    const result = buildLoginRedirectUrl();
    expect(result).toBe('/sign-in');
  });

  it('returns plain /sign-in for basename-prefixed /sign-in sub-paths', () => {
    const result = buildLoginRedirectUrl('/librechat/sign-in/2fa', '', '');
    expect(result).toBe('/sign-in');
  });

  it('does NOT match paths where "login" is a substring of a segment', () => {
    const result = buildLoginRedirectUrl('/c/sign-inhistory', '', '');
    expect(result).toContain('redirect_to=');
    expect(decodeURIComponent(result.split('redirect_to=')[1])).toBe('/c/sign-inhistory');
  });
});

describe('getPostLoginRedirect', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns the redirect_to param when valid', () => {
    const params = new URLSearchParams('redirect_to=%2Fc%2Fnew');
    expect(getPostLoginRedirect(params)).toBe('/c/new');
  });

  it('falls back to sessionStorage when no URL param', () => {
    sessionStorage.setItem(SESSION_KEY, '/c/abc123');
    const params = new URLSearchParams();
    expect(getPostLoginRedirect(params)).toBe('/c/abc123');
  });

  it('prefers URL param over sessionStorage', () => {
    sessionStorage.setItem(SESSION_KEY, '/c/old');
    const params = new URLSearchParams('redirect_to=%2Fc%2Fnew');
    expect(getPostLoginRedirect(params)).toBe('/c/new');
  });

  it('clears sessionStorage after reading', () => {
    sessionStorage.setItem(SESSION_KEY, '/c/abc123');
    const params = new URLSearchParams();
    getPostLoginRedirect(params);
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('returns null when no redirect source exists', () => {
    const params = new URLSearchParams();
    expect(getPostLoginRedirect(params)).toBeNull();
  });

  it('rejects an absolute URL from params', () => {
    const params = new URLSearchParams('redirect_to=https%3A%2F%2Fevil.com');
    expect(getPostLoginRedirect(params)).toBeNull();
  });

  it('rejects a protocol-relative URL from params', () => {
    const params = new URLSearchParams('redirect_to=%2F%2Fevil.com');
    expect(getPostLoginRedirect(params)).toBeNull();
  });

  it('rejects an absolute URL from sessionStorage', () => {
    sessionStorage.setItem(SESSION_KEY, 'https://evil.com');
    const params = new URLSearchParams();
    expect(getPostLoginRedirect(params)).toBeNull();
  });

  it('rejects /sign-in redirect to prevent loops', () => {
    const params = new URLSearchParams('redirect_to=%2Flogin');
    expect(getPostLoginRedirect(params)).toBeNull();
  });

  it('rejects /sign-in sub-path redirect', () => {
    const params = new URLSearchParams('redirect_to=%2Flogin%2F2fa');
    expect(getPostLoginRedirect(params)).toBeNull();
  });

  it('still clears sessionStorage even when target is unsafe', () => {
    sessionStorage.setItem(SESSION_KEY, 'https://evil.com');
    const params = new URLSearchParams();
    getPostLoginRedirect(params);
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

describe('login error redirect_to preservation (AuthContext onError pattern)', () => {
  /** Mirrors the logic in AuthContext.tsx loginUser.onError */
  function buildLoginErrorPath(search: string): string {
    const redirectTo = new URLSearchParams(search).get('redirect_to');
    return redirectTo && isSafeRedirect(redirectTo)
      ? `/sign-in?redirect_to=${encodeURIComponent(redirectTo)}`
      : '/sign-in';
  }

  it('preserves a valid redirect_to across login failure', () => {
    const result = buildLoginErrorPath('?redirect_to=%2Fc%2Fnew');
    expect(result).toBe('/sign-in?redirect_to=%2Fc%2Fnew');
  });

  it('drops an open-redirect attempt (absolute URL)', () => {
    const result = buildLoginErrorPath('?redirect_to=https%3A%2F%2Fevil.com');
    expect(result).toBe('/sign-in');
  });

  it('drops a /sign-in redirect_to to prevent loops', () => {
    const result = buildLoginErrorPath('?redirect_to=%2Flogin');
    expect(result).toBe('/sign-in');
  });

  it('returns plain /sign-in when no redirect_to param exists', () => {
    const result = buildLoginErrorPath('');
    expect(result).toBe('/sign-in');
  });
});

describe('persistRedirectToSession', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('stores a valid relative path', () => {
    persistRedirectToSession('/c/new?q=hello');
    expect(sessionStorage.getItem(SESSION_KEY)).toBe('/c/new?q=hello');
  });

  it('rejects an absolute URL', () => {
    persistRedirectToSession('https://evil.com');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('rejects a protocol-relative URL', () => {
    persistRedirectToSession('//evil.com');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it('rejects /sign-in paths', () => {
    persistRedirectToSession('/sign-in?redirect_to=/c/new');
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

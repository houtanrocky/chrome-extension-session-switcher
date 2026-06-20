import { describe, it, expect } from 'vitest';
import {
  registrableDomain,
  domainFromUrl,
  hostFromUrl,
  siteName,
  isKnownSite,
} from './domains';

describe('registrableDomain', () => {
  it('returns a bare two-label domain unchanged', () => {
    expect(registrableDomain('claude.ai')).toBe('claude.ai');
  });

  it('collapses a subdomain to eTLD+1', () => {
    expect(registrableDomain('chat.foo.claude.ai')).toBe('claude.ai');
  });

  it('keeps three labels for multi-part public suffixes', () => {
    expect(registrableDomain('example.co.uk')).toBe('example.co.uk');
    expect(registrableDomain('shop.example.co.uk')).toBe('example.co.uk');
    expect(registrableDomain('foo.bar.com.au')).toBe('bar.com.au');
  });

  it('does not over-collapse non-suffix three-label domains', () => {
    expect(registrableDomain('a.example.com')).toBe('example.com');
  });

  it('lowercases and strips a trailing dot', () => {
    expect(registrableDomain('EXAMPLE.COM.')).toBe('example.com');
  });

  it('passes a single-label host through (e.g. localhost)', () => {
    expect(registrableDomain('localhost')).toBe('localhost');
  });
});

describe('domainFromUrl', () => {
  it('extracts the registrable domain from an https URL', () => {
    expect(domainFromUrl('https://chat.foo.claude.ai/projects?x=1')).toBe('claude.ai');
  });

  it('handles http and ports', () => {
    expect(domainFromUrl('http://localhost:3000/whoami')).toBe('localhost');
  });

  it('returns null for non-http(s) schemes', () => {
    expect(domainFromUrl('chrome://extensions')).toBeNull();
    expect(domainFromUrl('file:///C:/tmp/x.html')).toBeNull();
    expect(domainFromUrl('about:blank')).toBeNull();
  });

  it('returns null for missing or malformed input', () => {
    expect(domainFromUrl(null)).toBeNull();
    expect(domainFromUrl(undefined)).toBeNull();
    expect(domainFromUrl('')).toBeNull();
    expect(domainFromUrl('not a url')).toBeNull();
  });
});

describe('hostFromUrl', () => {
  it('returns the full hostname without port', () => {
    expect(hostFromUrl('https://api.claude.ai:443/v1')).toBe('api.claude.ai');
  });
  it('returns null for junk', () => {
    expect(hostFromUrl('::::')).toBeNull();
    expect(hostFromUrl(null)).toBeNull();
  });
});

describe('siteName', () => {
  it('uses the curated name for a known site', () => {
    expect(siteName('claude.ai')).toBe('Claude');
    expect(siteName('chatgpt.com')).toBe('ChatGPT');
    expect(siteName('notion.so')).toBe('Notion');
  });

  it('title-cases the base label for unknown sites', () => {
    expect(siteName('example.com')).toBe('Example');
    expect(siteName('mycoolapp.io')).toBe('Mycoolapp');
  });
});

describe('isKnownSite', () => {
  it('reflects the curated registry', () => {
    expect(isKnownSite('claude.ai')).toBe(true);
    expect(isKnownSite('example.com')).toBe(false);
  });
});

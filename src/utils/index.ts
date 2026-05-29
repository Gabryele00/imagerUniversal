// Shared utility functions and constants

import { COLORS } from '../config';

/** Default color for icons without specific branding */
export const DEFAULT_COLOR = COLORS.DEFAULT_ICON;

/** Format a byte size as human-readable text (e.g. "1.5 GB"); `unknownText` covers 0/unknown */
export function formatFileSize(
  bytes: number,
  unknownText: string = 'Unknown',
  precision: boolean = false
): string {
  if (bytes === 0) return unknownText;

  if (precision) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

/** Format bytes as a human-readable string (e.g. "2.3 GB") */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/** Preload an image, resolving true if it loaded and false on error */
export function preloadImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/** Parsed metadata from an Armbian image filename */
export interface ArmbianFilenameInfo {
  /** Board slug (lowercase, e.g. "nanopi-m5") */
  boardSlug: string;
  /** Version string (e.g. "25.02.0" or "26.2.0-trunk.493") */
  version: string | null;
  /** Distribution (e.g. "bookworm", "trixie") */
  distro: string | null;
  /** Branch (e.g. "current", "edge") */
  branch: string | null;
  /** Kernel version (e.g. "6.12.8") */
  kernel: string | null;
  /** Desktop environment or "minimal" */
  desktop: string | null;
}

/**
 * Parse an Armbian image filename into structured metadata.
 *
 * Handles three naming conventions:
 * - Standard:  `Armbian_{version}_{board}_{distro}_{branch}_{kernel}[_{desktop}]`
 * - Labeled:   `Armbian_{label}_{version}_{board}_...` (label when parts[1] is non-numeric)
 * - Prefixed:  `Armbian-unofficial_{version}_{board}_...`
 */
export function parseArmbianFilename(filename: string): ArmbianFilenameInfo | null {
  // Strip path if present
  const basename = filename.split('/').pop()?.split('\\').pop() ?? filename;

  // Strip compression extensions, then .img
  let name = basename;
  for (const ext of ['.xz', '.gz', '.zst', '.bz2']) {
    if (name.endsWith(ext)) {
      name = name.slice(0, -ext.length);
      break;
    }
  }
  if (name.endsWith('.img')) {
    name = name.slice(0, -4);
  }

  const parts = name.split('_');

  // Must start with "armbian" (possibly hyphenated, e.g. "Armbian-unofficial")
  if (parts.length < 4 || !parts[0].toLowerCase().startsWith('armbian')) {
    return null;
  }

  // If parts[1] doesn't start with a digit, it's a label (e.g. "community")
  const offset = parts[1] && !/^\d/.test(parts[1]) ? 1 : 0;

  // Need at least board index (2+offset) to exist
  if (parts.length < 3 + offset) {
    return null;
  }

  return {
    boardSlug: parts[2 + offset].toLowerCase(),
    version: parts[1 + offset] || null,
    distro: parts[3 + offset] || null,
    branch: parts[4 + offset] || null,
    kernel: parts[5 + offset] || null,
    desktop: parts.length > 6 + offset ? parts.slice(6 + offset).join('_') : null,
  };
}

/** Extract a message from an unknown error value, using `fallback` if none found */
export function getErrorMessage(error: unknown, fallback: string = 'An error occurred'): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}

/** Support tier priority order (lower index = higher priority) */
const SUPPORT_TIER_ORDER = ['platinum', 'standard', 'community', 'eos', 'tvb', 'wip'];

/**
 * Sort comparator for boards: Platinum > Standard > Community > EOS > TVB > WIP > Others (alphabetically)
 */
export function compareBoardsBySupport<T extends {
  support_tier: string;
  name: string;
}>(a: T, b: T): number {
  const aIdx = SUPPORT_TIER_ORDER.indexOf(a.support_tier);
  const bIdx = SUPPORT_TIER_ORDER.indexOf(b.support_tier);
  const aPriority = aIdx === -1 ? SUPPORT_TIER_ORDER.length : aIdx;
  const bPriority = bIdx === -1 ? SUPPORT_TIER_ORDER.length : bIdx;
  if (aPriority !== bPriority) return aPriority - bPriority;
  return a.name.localeCompare(b.name);
}

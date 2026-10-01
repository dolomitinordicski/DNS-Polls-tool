import type { DNSDesignSystem } from '@dolomitinordicski/dns-shared-data/design-system';
import { doc, getDoc } from 'firebase/firestore';
import { DNS_DESIGN_FALLBACK } from '../design/fallback';
import { dnsCoreDesignDb } from './dnsCoreDesign';

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

type DesignPayload = DeepPartial<DNSDesignSystem>;

function mergeObjects(base: unknown, patch: unknown): unknown {
  if (patch === undefined || patch === null) return base;
  if (Array.isArray(base) || Array.isArray(patch)) return patch;
  if (
    typeof base !== 'object' ||
    typeof patch !== 'object' ||
    base === null ||
    patch === null
  ) {
    return patch;
  }

  const result: Record<string, unknown> = {
    ...(base as Record<string, unknown>),
  };

  Object.entries(patch as Record<string, unknown>).forEach(([key, value]) => {
    result[key] = mergeObjects(result[key], value);
  });

  return result;
}

function mergeDesignSystem(payload: DesignPayload = {}): DNSDesignSystem {
  return mergeObjects(DNS_DESIGN_FALLBACK, payload) as DNSDesignSystem;
}

function applyVariables(designSystem: DNSDesignSystem) {
  const root = document.documentElement;
  const {
    colors,
    typography,
    shape,
    spacing,
    shadow,
    motion,
    contextSelector,
    navigation,
    header,
    footer,
    controls,
  } = designSystem;

  root.style.setProperty('--color-dns-deep', colors.deep);
  root.style.setProperty('--color-dns-mid', colors.mid);
  root.style.setProperty('--color-dns-light', colors.light);
  root.style.setProperty('--color-dns-bg', colors.background);
  root.style.setProperty('--color-dns-surface', colors.surface);
  root.style.setProperty('--color-dns-dark-text', colors.darkText);
  root.style.setProperty('--color-dns-muted', colors.mutedText);
  root.style.setProperty('--color-dns-border', colors.border);
  root.style.setProperty('--color-dns-subtle-border', colors.subtleBorder);
  root.style.setProperty('--color-dns-primary-dark', colors.primaryDark);
  root.style.setProperty('--color-dns-secondary-dark', colors.secondaryDark);

  // Backward-compatible aliases while Polls views are migrated view by view.
  root.style.setProperty('--dns-primary', colors.deep);
  root.style.setProperty('--dns-deep', colors.primaryDark);
  root.style.setProperty('--dns-teal', colors.mid);
  root.style.setProperty('--dns-soft', colors.light);
  root.style.setProperty('--dns-bg', colors.background);
  root.style.setProperty('--dns-card', colors.surface);
  root.style.setProperty('--dns-border', colors.border);

  root.style.setProperty('--font-display', `"${typography.primaryFamily}", sans-serif`);
  root.style.setProperty('--font-heading', `"${typography.primaryFamily}", sans-serif`);
  root.style.setProperty('--font-body', `"${typography.primaryFamily}", sans-serif`);
  root.style.setProperty('--font-alt', `"${typography.secondaryFamily}", sans-serif`);
  root.style.setProperty('--dns-base-font-size', `${typography.baseFontSizePx}px`);
  root.style.setProperty('--dns-heading-size', `${typography.headingPx}px`);
  root.style.setProperty('--dns-section-title-size', `${typography.sectionTitlePx}px`);
  root.style.setProperty('--dns-label-size', `${typography.labelPx}px`);
  root.style.setProperty('--dns-micro-size', `${typography.microPx}px`);
  root.style.setProperty('--dns-uppercase-tracking', `${typography.uppercaseTrackingEm}em`);

  root.style.setProperty('--dns-card-radius', `${shape.cardRadiusPx}px`);
  root.style.setProperty('--dns-control-radius', `${shape.controlRadiusPx}px`);
  root.style.setProperty('--dns-badge-radius', `${shape.badgeRadiusPx}px`);
  root.style.setProperty('--dns-page-x', `${spacing.pageXRem}rem`);
  root.style.setProperty('--dns-page-y', `${spacing.pageYRem}rem`);
  root.style.setProperty('--dns-card-padding', `${spacing.cardPaddingRem}rem`);
  root.style.setProperty('--dns-card-gap', `${spacing.cardGapPx}px`);

  root.style.setProperty('--dns-card-shadow', shadow.card);
  root.style.setProperty('--dns-header-shadow', shadow.header);
  root.style.setProperty('--dns-floating-shadow', shadow.floatingControl);

  root.style.setProperty('--dns-motion-fast', `${motion.fastMs}ms`);
  root.style.setProperty('--dns-motion-standard', `${motion.standardMs}ms`);
  root.style.setProperty('--dns-motion-reveal', `${motion.reveal.durationMs}ms`);
  root.style.setProperty('--dns-motion-easing', motion.easing);

  root.style.setProperty('--dns-header-bg', header.background);
  root.style.setProperty('--dns-header-logo-height', `${header.logoHeightPx}px`);
  root.style.setProperty('--dns-header-title-color', header.titleColor);
  root.style.setProperty('--dns-header-subtitle-color', header.subtitleColor);
  root.style.setProperty('--dns-header-title-size', `${header.titleSizePx}px`);
  root.style.setProperty('--dns-header-subtitle-size', `${header.subtitleSizePx}px`);

  root.style.setProperty('--dns-footer-bg', footer.background);
  root.style.setProperty('--dns-footer-text', footer.textColor);
  root.style.setProperty('--dns-footer-size', `${footer.fontSizePx}px`);

  root.style.setProperty('--dns-control-border', controls.border);
  root.style.setProperty('--dns-control-focus', controls.focusColor);
  root.style.setProperty('--dns-control-primary-bg', controls.primaryBackground);
  root.style.setProperty('--dns-control-primary-hover', controls.primaryHoverBackground);

  root.style.setProperty('--dns-context-selected-bg', contextSelector.selected.background);
  root.style.setProperty('--dns-context-selected-text', contextSelector.selected.text);
  root.style.setProperty('--dns-context-selected-border', contextSelector.selected.border);
  root.style.setProperty('--dns-context-hover-bg', contextSelector.hover.background);
  root.style.setProperty('--dns-context-hover-border', contextSelector.hover.border);

  root.style.setProperty('--dns-tab-bg', navigation.tabs.containerBackground);
  root.style.setProperty('--dns-tab-text', navigation.tabs.textColor);
  root.style.setProperty('--dns-tab-active', navigation.tabs.activeTextColor);
  root.style.setProperty('--dns-tab-hover', navigation.tabs.hoverTextColor);
  root.style.setProperty('--dns-tab-indicator', navigation.tabs.activeIndicatorColor);
  root.style.setProperty('--dns-tab-indicator-width', `${navigation.tabs.activeIndicatorWidthPx}px`);
  root.style.setProperty('--dns-tab-size', `${navigation.tabs.fontSizePx}px`);
  root.style.setProperty('--dns-tab-weight', String(navigation.tabs.fontWeight));
  root.style.setProperty('--dns-tab-tracking', `${navigation.tabs.letterSpacingEm}em`);
  root.style.setProperty(
    '--dns-nav-surface-bg',
    navigation.tabs.surfaceBackground ?? navigation.tabs.containerBackground,
  );
  root.style.setProperty(
    '--dns-nav-backdrop-blur',
    `${navigation.tabs.backdropBlurPx ?? 0}px`,
  );
  root.style.setProperty(
    '--dns-scroll-progress-height',
    `${navigation.tabs.scrollProgress?.heightPx ?? 0}px`,
  );
  root.style.setProperty(
    '--dns-scroll-progress-color',
    navigation.tabs.scrollProgress?.color ?? colors.light,
  );
  root.style.setProperty(
    '--dns-scroll-progress-track',
    navigation.tabs.scrollProgress?.track ?? 'transparent',
  );
}

export function applyDNSDesignFallback(): DNSDesignSystem {
  const fallback = mergeDesignSystem();
  applyVariables(fallback);
  return fallback;
}

export function dnsRuntimeSignature(designSystem: DNSDesignSystem) {
  return JSON.stringify({
    motion: designSystem.motion,
    interaction: designSystem.interaction,
  });
}

export async function loadAndApplyDNSDesignSystem() {
  const fallback = mergeDesignSystem();
  applyVariables(fallback);

  try {
    const snapshot = await getDoc(doc(dnsCoreDesignDb, 'designSystem', 'current'));
    if (!snapshot.exists()) {
      return {
        source: 'fallback' as const,
        version: fallback.version,
        designSystem: fallback,
      };
    }

    const designSystem = mergeDesignSystem(snapshot.data() as DesignPayload);
    applyVariables(designSystem);

    return {
      source: 'dns-core' as const,
      version: designSystem.version,
      designSystem,
    };
  } catch (error) {
    console.warn('DNS Design System remote load failed; using local fallback.', error);
    return {
      source: 'fallback' as const,
      version: fallback.version,
      designSystem: fallback,
    };
  }
}

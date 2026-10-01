import type { DNSDesignSystem } from '@dolomitinordicski/dns-shared-data/design-system';
import { initDNSRevealRuntime } from '@dolomitinordicski/dns-shared-data/ui/motion';
import { initDNSInteractionRuntime } from '@dolomitinordicski/dns-shared-data/ui/interaction';
import { initDNSToolChromeRuntime } from '@dolomitinordicski/dns-shared-data/ui/tool-chrome';
import { initDNSToolChromeRuntime } from '@dolomitinordicski/dns-shared-data/ui/tool-chrome';

export function initDNSUIRuntime(designSystem: DNSDesignSystem) {
  const interaction = initDNSInteractionRuntime({
    interaction: designSystem.interaction,
    motion: designSystem.motion,
  });

  const reveal = initDNSRevealRuntime({
    motion: designSystem.motion,
    selector: '[data-dns-reveal]',
    observeMutations: true,
  });

  const chrome = initDNSToolChromeRuntime({
    navigation: designSystem.navigation,
    responsive: designSystem.responsive,
    headerTokens: designSystem.header,
    motion: designSystem.motion,
  });

  return () => {
    chrome.disconnect();
    reveal.disconnect();
    interaction.disconnect();
  };
}

import type { DNSDesignSystem } from '@dolomitinordicski/dns-shared-data/design-system';
import { initDNSRevealRuntime } from '@dolomitinordicski/dns-shared-data/ui/motion';
import { initDNSInteractionRuntime } from '@dolomitinordicski/dns-shared-data/ui/interaction';

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

  return () => {
    reveal.disconnect();
    interaction.disconnect();
  };
}

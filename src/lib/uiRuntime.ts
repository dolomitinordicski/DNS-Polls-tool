import { DNS_DESIGN_SYSTEM } from '@dolomitinordicski/dns-shared-data/design-system';
import { initDNSRevealRuntime } from '@dolomitinordicski/dns-shared-data/ui/motion';
import { initDNSInteractionRuntime } from '@dolomitinordicski/dns-shared-data/ui/interaction';

function applyMotionVariables() {
  const root = document.documentElement;
  const { motion } = DNS_DESIGN_SYSTEM;

  root.style.setProperty('--dns-motion-fast', `${motion.fastMs}ms`);
  root.style.setProperty('--dns-motion-standard', `${motion.standardMs}ms`);
  root.style.setProperty('--dns-motion-reveal', `${motion.reveal.durationMs}ms`);
  root.style.setProperty('--dns-motion-easing', motion.easing);
}

export function initDNSUIRuntime() {
  applyMotionVariables();

  const interaction = initDNSInteractionRuntime({
    interaction: DNS_DESIGN_SYSTEM.interaction,
    motion: DNS_DESIGN_SYSTEM.motion,
  });

  const reveal = initDNSRevealRuntime({
    motion: DNS_DESIGN_SYSTEM.motion,
    selector: '[data-dns-reveal]',
    observeMutations: true,
  });

  return () => {
    reveal.disconnect();
    interaction.disconnect();
  };
}

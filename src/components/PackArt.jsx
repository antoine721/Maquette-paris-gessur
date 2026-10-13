// Le booster : emballage métallisé aux couleurs de son thème.
import { motion } from 'motion/react';
import { PACK_LOOK } from '../lib/visuals.jsx';

export function PackArt({ pack, top, className = '', style, children, size = 5 }) {
  const look = PACK_LOOK[pack.key] ?? PACK_LOOK.encyclopedie;
  const Icon = look.Icon;
  return (
    <div className={`pack ${className}`} style={{ '--pc1': look.c1, '--pc2': look.c2, '--pc3': look.c3, ...style }}>
      <motion.div className="absolute inset-x-0 top-0 h-[12%]" style={{ transformOrigin: '18% 100%', zIndex: 3 }} {...top}>
        <div className="pack-part pack-crimp top" style={{ height: '50%' }} />
        <div className="pack-part pack-strip" style={{ top: '50%', height: '50%' }} />
      </motion.div>
      <div className="pack-part pack-body">
        <div className="pack-art">
          <span className="pack-emblem">{Icon ? <Icon weight="duotone" /> : <b>W</b>}</span>
          <span className="pack-name">{pack.label}</span>
          <span className="pack-sub">{pack.tagline}</span>
          <span className="pack-count">{size} CARTES</span>
        </div>
        <div className="pack-glare" />
      </div>
      <div className="pack-part pack-crimp bottom" />
      {children}
    </div>
  );
}

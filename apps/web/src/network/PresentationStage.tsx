import { useEffect, useRef } from 'react';
import type { Motion } from './motion';

// A code-rendered presentation surround. No video pixels or reference frames are used.
export function PresentationStage({ motion }: { motion: Motion }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current, ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, 750, 512); ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, 750, 512);
    const wall = ctx.createLinearGradient(0, 0, 750, 512); wall.addColorStop(0, '#100e17'); wall.addColorStop(.5, '#08070d'); wall.addColorStop(1, '#05050a'); ctx.fillStyle = wall; ctx.fillRect(0, 0, 750, 512);
    for (const [x, y, width, height] of [[-50, 210, 180, 300], [530, 250, 250, 300], [185, 390, 370, 150], [585, 75, 230, 230]]) {
      const gradient = ctx.createLinearGradient(x!, y!, x! + width!, y!); gradient.addColorStop(0, '#20222b'); gradient.addColorStop(.18, '#10121a'); gradient.addColorStop(.7, '#07070c'); gradient.addColorStop(1, '#0e0e16'); ctx.fillStyle = gradient; ctx.fillRect(x!, y!, width!, height!);
      ctx.beginPath(); ctx.ellipse(x! + width! / 2, y!, width! / 2, width! * .12, 0, 0, Math.PI * 2); ctx.fillStyle = '#191b24'; ctx.fill();
    }
    const far = motion.t >= 10.5 && motion.t < 12.9;
    const top = far ? 365 : 440;
    const body = ctx.createLinearGradient(0, top, 750, top);
    body.addColorStop(0, '#191d26'); body.addColorStop(.2, '#0b0c13'); body.addColorStop(.7, '#05050b'); body.addColorStop(1, '#0d1018');
    ctx.fillStyle = body; ctx.fillRect(0, top, 750, 512 - top);
    const plinth = ctx.createLinearGradient(0, top - 50, 750, top + 25);
    plinth.addColorStop(0, '#28343d'); plinth.addColorStop(.35, '#131722'); plinth.addColorStop(.7, '#090b13'); plinth.addColorStop(1, '#0b0d16');
    ctx.fillStyle = plinth; ctx.beginPath(); ctx.ellipse(375, top, 430, 52, 0, 0, Math.PI * 2); ctx.fill();
    for (const shift of [0, 22, 57]) { ctx.beginPath(); ctx.ellipse(375, top + shift, 430, 52, 0, 0, Math.PI); ctx.strokeStyle = shift === 0 ? '#242a35' : '#151923'; ctx.lineWidth = shift === 0 ? 1 : 2; ctx.stroke(); }
    const shadow = ctx.createLinearGradient(0, top + 50, 0, 512); shadow.addColorStop(0, '#00000000'); shadow.addColorStop(1, '#00000085'); ctx.fillStyle = shadow; ctx.fillRect(0, top + 50, 750, 512 - top - 50);
  }, [motion.t, motion.environment]);
  return <canvas ref={ref} width="750" height="512" className="presentation-surround" style={{ opacity: motion.environment }} aria-hidden="true" />;
}

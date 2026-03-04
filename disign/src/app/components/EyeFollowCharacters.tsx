import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'motion/react';

export type CharacterState = 'idle' | 'email' | 'password' | 'success';

interface Props {
  state?: CharacterState;
}

// Viewbox matching Figma coordinates
const VB = '100 280 680 590';

function useMouse() {
  const pos = useRef({ x: 0, y: 0 });
  const [, setTick] = useState(0);
  const raf = useRef(0);
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      target.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMove);

    let running = true;
    const loop = () => {
      if (!running) return;
      // Lerp for smoothness
      pos.current.x += (target.current.x - pos.current.x) * 0.15;
      pos.current.y += (target.current.y - pos.current.y) * 0.15;
      setTick((t) => t + 1);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(raf.current);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return pos;
}

function svgToScreen(
  svg: SVGSVGElement | null,
  sx: number,
  sy: number
): { x: number; y: number } {
  if (!svg) return { x: 0, y: 0 };
  const r = svg.getBoundingClientRect();
  return {
    x: r.left + ((sx - 100) / 680) * r.width,
    y: r.top + ((sy - 280) / 590) * r.height,
  };
}

function getOffset(
  svg: SVGSVGElement | null,
  cx: number,
  cy: number,
  mouse: { x: number; y: number },
  maxMove: number
): { x: number; y: number } {
  const s = svgToScreen(svg, cx, cy);
  const dx = mouse.x - s.x;
  const dy = mouse.y - s.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return { x: 0, y: 0 };
  const f = Math.min(1, dist / 200);
  return {
    x: (dx / dist) * maxMove * f,
    y: (dy / dist) * maxMove * f,
  };
}

// ---- Transition configs ----
const springEye = { type: 'spring' as const, stiffness: 300, damping: 22, mass: 0.8 };
const springBounce = { type: 'spring' as const, stiffness: 400, damping: 12, mass: 0.6 };
const springSmooth = { type: 'spring' as const, stiffness: 200, damping: 20 };

// ---- Sub-components for each character ----

function PurpleCharacter({
  state,
  svgRef,
  mouse,
}: {
  state: CharacterState;
  svgRef: React.RefObject<SVGSVGElement | null>;
  mouse: React.RefObject<{ x: number; y: number }>;
}) {
  const maxMove = 5;
  const isIdle = state === 'idle';
  const isEmail = state === 'email';

  const oL = isIdle ? getOffset(svgRef.current, 403, 350, mouse.current, maxMove) : { x: 0, y: isEmail ? maxMove : 0 };
  const oR = isIdle ? getOffset(svgRef.current, 476, 350, mouse.current, maxMove) : { x: 0, y: isEmail ? maxMove : 0 };

  return (
    <motion.g
      animate={{ y: state === 'success' ? -18 : 0 }}
      transition={state === 'success' ? springBounce : springSmooth}
    >
      <rect x="279" y="317" width="268" height="531" fill="#6729FF" />
      {/* Nose */}
      <rect x="435" y="348" width="7" height="42" rx="1" fill="black" />

      {/* Eyes */}
      {state === 'password' ? (
        /* Covering hands animate in from sides */
        <>
          <motion.rect
            x={375} y={335} width={50} height={32} rx={10}
            fill="#5520CC"
            initial={{ x: 310, opacity: 0 }}
            animate={{ x: 375, opacity: 1 }}
            exit={{ x: 310, opacity: 0 }}
            transition={springSmooth}
          />
          <motion.rect
            x={455} y={335} width={50} height={32} rx={10}
            fill="#5520CC"
            initial={{ x: 520, opacity: 0 }}
            animate={{ x: 455, opacity: 1 }}
            exit={{ x: 520, opacity: 0 }}
            transition={springSmooth}
          />
        </>
      ) : state === 'success' ? (
        <>
          <motion.path
            d="M395 353 Q403 341 411 353"
            stroke="black" strokeWidth="3.5" fill="none" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.3 }}
          />
          <motion.path
            d="M468 353 Q476 341 484 353"
            stroke="black" strokeWidth="3.5" fill="none" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          />
        </>
      ) : (
        <>
          <rect x={398 + oL.x} y={344 + oL.y} width="10" height="12" rx="2" fill="black" />
          <rect x={471 + oR.x} y={344 + oR.y} width="10" height="12" rx="2" fill="black" />
        </>
      )}
    </motion.g>
  );
}

function DarkCharacter({
  state,
  svgRef,
  mouse,
}: {
  state: CharacterState;
  svgRef: React.RefObject<SVGSVGElement | null>;
  mouse: React.RefObject<{ x: number; y: number }>;
}) {
  const maxMove = 4.5;
  const isIdle = state === 'idle';
  const isEmail = state === 'email';

  const oL = isIdle ? getOffset(svgRef.current, 540, 537, mouse.current, maxMove) : { x: 0, y: isEmail ? maxMove : 0 };
  const oR = isIdle ? getOffset(svgRef.current, 576, 537, mouse.current, maxMove) : { x: 0, y: isEmail ? maxMove : 0 };

  return (
    <motion.g
      animate={{ y: state === 'success' ? -12 : 0 }}
      transition={state === 'success' ? { ...springBounce, delay: 0.08 } : springSmooth}
    >
      <rect x="483" y="485" width="148" height="365" rx="2" fill="#1C1D21" />

      {/* White sockets always visible */}
      <ellipse cx="540" cy="537" rx="10" ry="10" fill="white" />
      <ellipse cx="576" cy="537" rx="10" ry="10" fill="white" />

      {state === 'password' ? (
        <>
          <motion.line
            x1={534} y1={537} x2={546} y2={537}
            stroke="black" strokeWidth="2.5" strokeLinecap="round"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.2 }}
          />
          <motion.line
            x1={570} y1={537} x2={582} y2={537}
            stroke="black" strokeWidth="2.5" strokeLinecap="round"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.2, delay: 0.05 }}
          />
        </>
      ) : state === 'success' ? (
        <>
          <motion.path
            d="M534 539 Q540 531 546 539"
            stroke="black" strokeWidth="2.5" fill="none" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.25, delay: 0.05 }}
          />
          <motion.path
            d="M570 539 Q576 531 582 539"
            stroke="black" strokeWidth="2.5" fill="none" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.25, delay: 0.1 }}
          />
        </>
      ) : (
        <>
          <circle cx={540 + oL.x} cy={537 + oL.y} r="4.5" fill="black" />
          <circle cx={576 + oR.x} cy={537 + oR.y} r="4.5" fill="black" />
        </>
      )}
    </motion.g>
  );
}

function OrangeCharacter({
  state,
  svgRef,
  mouse,
}: {
  state: CharacterState;
  svgRef: React.RefObject<SVGSVGElement | null>;
  mouse: React.RefObject<{ x: number; y: number }>;
}) {
  const maxMove = 8;
  const isIdle = state === 'idle';
  const isEmail = state === 'email';

  const oL = isIdle ? getOffset(svgRef.current, 300, 750, mouse.current, maxMove) : { x: 0, y: isEmail ? maxMove * 0.5 : 0 };
  const oR = isIdle ? getOffset(svgRef.current, 380, 750, mouse.current, maxMove) : { x: 0, y: isEmail ? maxMove * 0.5 : 0 };

  return (
    <motion.g
      animate={{ y: state === 'success' ? -20 : 0 }}
      transition={state === 'success' ? { ...springBounce, delay: 0.04 } : springSmooth}
    >
      <path
        d="M533 849.5C533 821.725 527.762 794.223 517.586 768.562C507.409 742.902 492.493 719.587 473.689 699.947C454.885 680.307 432.562 664.728 407.993 654.099C383.425 643.471 357.093 638 330.5 638C303.907 638 277.575 643.471 253.007 654.099C228.438 664.728 206.115 680.307 187.311 699.947C168.507 719.587 153.591 742.902 143.414 768.562C133.238 794.223 128 821.725 128 849.5L330.5 849.5H533Z"
        fill="#FF8634"
      />

      {/* Eyes */}
      {state === 'password' ? (
        <>
          <motion.line
            x1={291} y1={750} x2={309} y2={750}
            stroke="black" strokeWidth="3.5" strokeLinecap="round"
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
            transition={{ duration: 0.2 }}
            style={{ transformOrigin: '300px 750px' }}
          />
          <motion.line
            x1={371} y1={750} x2={389} y2={750}
            stroke="black" strokeWidth="3.5" strokeLinecap="round"
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            style={{ transformOrigin: '380px 750px' }}
          />
        </>
      ) : state === 'success' ? (
        <>
          <motion.path
            d="M291 753 Q300 740 309 753"
            stroke="black" strokeWidth="3.5" fill="none" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.3 }}
          />
          <motion.path
            d="M371 753 Q380 740 389 753"
            stroke="black" strokeWidth="3.5" fill="none" strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          />
        </>
      ) : (
        <>
          <circle cx={300 + oL.x} cy={750 + oL.y} r="8" fill="black" />
          <circle cx={380 + oR.x} cy={750 + oR.y} r="8" fill="black" />
        </>
      )}

      {/* Smile */}
      <motion.path
        d="M402 777.5C402 780.061 401.34 782.596 400.059 784.962C398.777 787.328 396.899 789.478 394.531 791.289C392.163 793.099 389.352 794.536 386.258 795.516C383.165 796.496 379.849 797 376.5 797C373.151 797 369.835 796.496 366.742 795.516C363.648 794.536 360.837 793.099 358.469 791.289C356.101 789.478 354.223 787.328 352.941 784.962C351.66 782.596 351 780.061 351 777.5L376.5 777.5H402Z"
        fill="black"
        animate={{
          scale: state === 'success' ? 1.3 : 1,
        }}
        style={{ transformOrigin: '376px 787px' }}
        transition={springSmooth}
      />
    </motion.g>
  );
}

function YellowCharacter({
  state,
  svgRef,
  mouse,
}: {
  state: CharacterState;
  svgRef: React.RefObject<SVGSVGElement | null>;
  mouse: React.RefObject<{ x: number; y: number }>;
}) {
  const maxMove = 4;
  const isIdle = state === 'idle';
  const isEmail = state === 'email';

  const o = isIdle ? getOffset(svgRef.current, 641, 645, mouse.current, maxMove) : { x: 0, y: isEmail ? maxMove : 0 };

  return (
    <motion.g
      animate={{ y: state === 'success' ? -14 : 0 }}
      transition={state === 'success' ? { ...springBounce, delay: 0.12 } : springSmooth}
    >
      <path
        d="M739 668C739 648.904 730.888 630.591 716.447 617.088C702.007 603.586 682.422 596 662 596C641.578 596 621.993 603.586 607.553 617.088C593.112 630.591 585 648.904 585 668L662 668H739Z"
        fill="#E7CB0C"
      />
      <rect x="585" y="665" width="154" height="185" fill="#E7CB0C" />

      {/* Eye */}
      {state === 'password' ? (
        <motion.line
          x1={634} y1={645} x2={648} y2={645}
          stroke="black" strokeWidth="3.5" strokeLinecap="round"
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
          transition={{ duration: 0.2, delay: 0.08 }}
          style={{ transformOrigin: '641px 645px' }}
        />
      ) : state === 'success' ? (
        <motion.path
          d="M634 648 Q641 636 648 648"
          stroke="black" strokeWidth="3.5" fill="none" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.3, delay: 0.08 }}
        />
      ) : (
        <circle cx={641 + o.x} cy={645 + o.y} r="5" fill="black" />
      )}

      {/* Mouth — horizontal line */}
      <rect x="676" y="668" width="100" height="7" rx="1" fill="black" />
    </motion.g>
  );
}

export function EyeFollowCharacters({ state = 'idle' }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const mouse = useMouse();

  return (
    <svg
      ref={svgRef}
      viewBox={VB}
      className="w-full max-w-[460px] h-auto select-none"
      style={{ overflow: 'visible' }}
    >
      {/* Render back-to-front for correct overlap */}
      <OrangeCharacter state={state} svgRef={svgRef} mouse={mouse} />
      <PurpleCharacter state={state} svgRef={svgRef} mouse={mouse} />
      <DarkCharacter state={state} svgRef={svgRef} mouse={mouse} />
      <YellowCharacter state={state} svgRef={svgRef} mouse={mouse} />
    </svg>
  );
}

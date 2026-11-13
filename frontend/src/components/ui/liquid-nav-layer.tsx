"use client";

/**
 * A pill of water behind the desktop nav. The active drop stretches toward the
 * item under the pointer, splits into droplets on long jumps and merges back
 * with a ripple; every tap sends a wave along the pill.
 *
 * The layer is painted by a tiny WebGL shader that only runs while the header
 * is on screen. Without WebGL a plain CSS drop takes over, so the nav still
 * reads without the effect.
 *
 * Effect adapted from Nimbus UI "Liquid Navbar" by guglielmogiannattasio.it.
 *
 * Contract:
 * - The layer sizes and positions itself against `[data-liquid-nav]` (the
 *   closest positioned ancestor it lives in).
 * - Every clickable nav cell must carry `data-liquid-item`; the one under the
 *   pointer wins, then an open panel trigger, then `aria-current="page"`.
 * - The layer is decorative and inert: `pointer-events-none`, `aria-hidden`.
 */

import * as React from "react";

/** Canvas bleed around the pill, so shadows and ripples have room. */
const PAD = 14;

type Body = { x: number; v: number };
type Sat = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  k: number;
};
type Rip = { x: number; y: number; age: number; amp: number };

const CSS = `
.lg-nav-glass{position:absolute;inset:0;border-radius:999px;z-index:-2;overflow:hidden;background:var(--lg-tint);
  -webkit-backdrop-filter:blur(10px) saturate(1.2) brightness(1.08);backdrop-filter:blur(10px) saturate(1.2) brightness(1.08);
  box-shadow:inset 0 1px 1px var(--lg-rim),inset 0 0 0 1px var(--lg-edge),0 12px 32px -14px rgba(0,40,90,.5),0 2px 6px rgba(0,40,90,.1)}
.lg-nav-water{position:absolute;left:${-PAD}px;top:${-PAD}px;z-index:-1;pointer-events:none}
[data-gl="off"] .lg-nav-water{display:none}
.lg-nav-drop{display:none;position:absolute;top:0;bottom:0;left:0;border-radius:999px;z-index:-1;pointer-events:none;will-change:transform,width;
  background:radial-gradient(120% 140% at 30% 0%,rgba(255,255,255,.75),rgba(255,255,255,0) 55%),rgba(255,255,255,.38);
  box-shadow:inset 0 1px 1px rgba(255,255,255,.95),inset 0 -2px 6px rgba(0,162,255,.22),inset 0 0 0 1px rgba(255,255,255,.55),0 6px 16px -6px rgba(0,70,140,.45)}
[data-gl="off"] .lg-nav-drop{display:block}
`;

const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
const FRAG = `precision highp float;
uniform vec2 uRes;uniform float uDpr;uniform float uTime;uniform vec4 uPill;
uniform vec4 uBlob[6];uniform float uSy[6];uniform vec4 uRip[6];uniform vec3 uMouse;uniform float uDark;uniform float uAmb;
float sdRB(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float sdCap(vec2 p,vec4 B,float sy){p-=B.xy;p.y/=sy;p.x=max(abs(p.x)-B.z,0.);return(length(p)-B.w)*min(1.,sy);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float dropD(vec2 p){float d=1e4;for(int i=0;i<6;i++){if(uBlob[i].w>.5){d=smin(d,sdCap(p,uBlob[i],uSy[i]),13.);}}return d;}
float pillD(vec2 p){vec2 h=uPill.zw*.5;return sdRB(p-uPill.xy-h,h,h.y);}
float lens(float d,float w){float t=clamp(-d/w,0.,1.);return sqrt(1.-(1.-t)*(1.-t));}
float waves(vec2 p){float w=0.;
 for(int i=0;i<6;i++){vec4 R=uRip[i];if(R.w>0.){float x=length(p-R.xy)-R.z*240.;w+=R.w*exp(-R.z*1.7)*sin(x*.3)*exp(-x*x/700.);}}
 vec2 m=p-uMouse.xy;w+=uMouse.z*3.6*exp(-dot(m,m)/1000.);
 w+=uAmb*(sin(p.x*.05+uTime*1.2)*.45+sin(p.x*.13-uTime*.85+p.y*.2)*.25);return w;}
float H(vec2 p){float dp=pillD(p);return lens(dp,uPill.w*.36)*2.4+lens(dropD(p),11.)*7.5+waves(p)*smoothstep(0.,7.,-dp);}
float caus(vec2 p,float t){vec2 q=p;float c=0.;for(int i=0;i<3;i++){q+=vec2(sin(q.y*1.1+t),cos(q.x*1.3-t*.7))*.6;c+=1./(1.+16.*abs(sin(q.x)*sin(q.y)));}return c/3.;}
void main(){
 vec2 p=vec2(gl_FragCoord.x,uRes.y*uDpr-gl_FragCoord.y)/uDpr;
 float dp=pillD(p);float dd=dropD(p);
 float h0=H(p);vec3 n=normalize(vec3(h0-H(p+vec2(1.,0.)),h0-H(p+vec2(0.,1.)),1.));
 vec3 V=vec3(0.,0.,1.);
 float spec=pow(max(dot(reflect(-normalize(vec3(-.45,-.8,.85)),n),V),0.),70.);
 float spec2=pow(max(dot(reflect(-normalize(vec3(.6,.75,.7)),n),V),0.),22.)*.3;
 float fres=clamp((1.-n.z)*4.,0.,1.);
 vec3 irid=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+fres*.85+p.x*.0028+uTime*.035));
 float pm=smoothstep(1.,-1.,dp);float dm=smoothstep(1.,-1.,dd)*smoothstep(1.,-2.,dp);
 float sh=smoothstep(9.,-9.,dropD(p-vec2(0.,5.)))*(1.-dm)*pm*(.11+.07*uDark);
 vec3 c=vec3(0.,.14,.36)*sh;float a=sh;
 float pa=clamp(pm*(fres*.5+spec*.9+spec2),0.,1.);
 c=mix(vec3(1.),irid,.5*fres)*pa+c*(1.-pa);a=pa+a*(1.-pa);
 float th=lens(dd,11.);
 float cs=caus((p+n.xy*th*18.)*.085,uTime*.9);
 vec3 tint=mix(vec3(.80,.95,1.),vec3(.55,.82,1.),uDark);
 float rim=dm*(1.-smoothstep(0.,8.,-dd));
 float cres=dm*smoothstep(.12,.55,dot(n.xy,normalize(vec2(.55,.85))))*smoothstep(0.,3.,-dd);
 float body=.5+.5*clamp(-n.y*3.,-1.,1.);
 float da=dm*(.26+.14*body)*(1.-.35*uDark);vec3 dc=mix(tint,vec3(1.),body*.6);
 float la=rim*.22;vec3 lc=mix(vec3(0.,.42,.78),vec3(.1,.55,.95),uDark);dc=lc*la+dc*da*(1.-la);da=la+da*(1.-la);
 la=clamp(cres*.7+smoothstep(.6,1.,cs)*.28*th*dm,0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=clamp(dm*(spec*1.2+spec2*.5),0.,1.);dc=vec3(1.)*la+dc*(1.-la);da=la+da*(1.-la);
 la=dm*smoothstep(-2.,0.,dd)*.4;dc=mix(vec3(1.),irid,.35)*la+dc*(1.-la);da=la+da*(1.-la);
 c=dc+c*(1.-da);a=da+a*(1.-da);
 gl_FragColor=vec4(c,a);
}`;

/** The physics state. Everything the rAF loop reads lives here. */
function makeState() {
  return {
    a: { x: 0, v: 0 } as Body,
    b: { x: 0, v: 0 } as Body,
    sy: { s: 1, v: 0 },
    /** which body leads the stretch toward a new item */
    lead: 0 as 0 | 1,
    lagFrom: 0,
    sats: [] as Sat[],
    rips: [] as Rip[],
    t: { x: 0, cy: 0, q: 0, r: 21 },
    q: 0,
    mouse: { x: 0, y: 0, s: 0, on: false },
    /** index of the cell under the pointer, null when it leaves */
    hover: null as number | null,
    moving: false,
    split: false,
    ready: false,
    w: 0,
    h: 0,
    visible: true,
    reduce: false,
    raf: 0,
    last: 0,
    time: 0,
    glc: null as null | {
      gl: WebGLRenderingContext;
      u: Record<string, WebGLUniformLocation | null>;
    },
  };
}

function initGL(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", {
    premultipliedAlpha: true,
    alpha: true,
    antialias: false,
  }) as WebGLRenderingContext | null;
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const attr = gl.getAttribLocation(program, "a");
  gl.enableVertexAttribArray(attr);
  gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);

  const u: Record<string, WebGLUniformLocation | null> = {};
  for (const name of [
    "uRes",
    "uDpr",
    "uTime",
    "uPill",
    "uBlob",
    "uSy",
    "uRip",
    "uMouse",
    "uDark",
    "uAmb",
  ]) {
    u[name] = gl.getUniformLocation(program, name);
  }

  return { gl, u };
}

export function LiquidNavLayer({
  tone = "light",
  className,
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const rootRef = React.useRef<HTMLSpanElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const dropRef = React.useRef<HTMLSpanElement>(null);
  const st = React.useRef(makeState());
  const [gl, setGl] = React.useState<"on" | "off">("on");
  // The rAF loop is created once, so the tone reaches it through a ref that an
  // effect keeps in sync instead of closing over props.
  const darkRef = React.useRef(tone === "dark" ? 1 : 0);

  /** The positioned ancestor the pill hugs, and the cells inside it. */
  const host = React.useCallback(
    () => rootRef.current?.closest<HTMLElement>("[data-liquid-nav]") ?? null,
    [],
  );
  const cells = React.useCallback(() => {
    const el = host();
    return el
      ? Array.from(el.querySelectorAll<HTMLElement>("[data-liquid-item]"))
      : [];
  }, [host]);

  /** Pointer wins, then an open panel, then the current page. */
  const targetIndex = React.useCallback(() => {
    const list = cells();
    const hovered = st.current.hover;
    if (hovered !== null && list[hovered]) return hovered;
    const open = list.findIndex((el) => el.dataset.state === "open");
    if (open >= 0) return open;
    return list.findIndex((el) => el.getAttribute("aria-current") === "page");
  }, [cells]);

  const draw = React.useCallback(() => {
    const s = st.current;
    const T = s.t;
    const sep = Math.abs(s.a.x - s.b.x);
    const thin = Math.min(sep / (2 * (s.q + T.r) || 1), 1);
    const radius = T.r * (1 - 0.3 * thin);

    if (s.glc) {
      const { gl: g, u } = s.glc;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      g.viewport(0, 0, g.drawingBufferWidth, g.drawingBufferHeight);
      g.uniform2f(u.uRes, s.w + PAD * 2, s.h + PAD * 2);
      g.uniform1f(u.uDpr, dpr);
      g.uniform1f(u.uTime, s.time);
      g.uniform4f(u.uPill, PAD, PAD, s.w, s.h);

      const blobs = new Float32Array(24);
      const sy = new Float32Array(6).fill(1);
      const head = s.lead === 0 ? s.a : s.b;
      const tail = s.lead === 0 ? s.b : s.a;
      blobs.set(
        [
          head.x,
          T.cy,
          s.q * (1 - 0.25 * thin),
          T.r * (1 - 0.12 * thin),
          tail.x,
          T.cy,
          s.q * (1 - 0.8 * thin),
          T.r * (1 - 0.5 * thin),
        ],
        0,
      );
      sy[0] = sy[1] = s.sy.s;
      s.sats
        .slice(0, 4)
        .forEach((d, i) => blobs.set([d.x, d.y, 0, d.r], 8 + i * 4));
      g.uniform4fv(u.uBlob, blobs);
      g.uniform1fv(u.uSy, sy);

      const rips = new Float32Array(24);
      s.rips
        .slice(-6)
        .forEach((p, i) => rips.set([p.x, p.y, p.age, p.amp], i * 4));
      g.uniform4fv(u.uRip, rips);
      g.uniform3f(u.uMouse, s.mouse.x, s.mouse.y, s.mouse.s);
      g.uniform1f(u.uDark, darkRef.current);
      g.uniform1f(u.uAmb, s.reduce ? 0 : 1);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.drawArrays(g.TRIANGLES, 0, 3);
      return;
    }

    // CSS fallback: one rounded drop spanning both bodies.
    const drop = dropRef.current;
    if (drop) {
      const left = Math.min(s.a.x, s.b.x) - s.q - radius - PAD;
      drop.style.width = `${sep + 2 * (s.q + radius)}px`;
      drop.style.transform = `translateX(${left}px) scaleY(${s.sy.s})`;
    }
  }, []);

  const step = React.useCallback((dt: number, now: number) => {
    const s = st.current;
    const T = s.t;
    s.time += dt;
    s.q += (T.q - s.q) * Math.min(1, dt * 12);
    const bodies = [s.a, s.b];
    let still = true;

    if (s.reduce) {
      s.a.x = s.b.x = T.x;
      s.a.v = s.b.v = 0;
      s.sy.s = 1;
      s.sats = [];
    } else {
      bodies.forEach((body, i) => {
        const isLead = i === s.lead;
        const k = isLead ? 210 : 72;
        const c = isLead ? 25 : 13;
        // The trailing body hangs back for a beat, which is what stretches
        // the neck instead of sliding the whole pill.
        const f = !isLead && now < s.lagFrom ? 0.08 : 1;
        body.v += (k * (T.x - body.x) - c * body.v) * dt * f;
        body.x += body.v * dt;
        const lo = PAD + 6 + s.q + T.r - 3;
        const hi = PAD + s.w - 6 - s.q - T.r + 3;
        if (body.x < lo || body.x > hi) {
          s.sy.v -= Math.min(Math.abs(body.v), 900) * 0.0016;
          body.x = Math.max(lo, Math.min(hi, body.x));
          body.v *= -0.25;
        }
        if (Math.abs(T.x - body.x) > 0.3 || Math.abs(body.v) > 3) still = false;
      });

      const leadBody = bodies[s.lead];
      const syTarget = 1 - 0.2 * Math.min(Math.abs(leadBody.v) / 1500, 1);
      s.sy.v += (280 * (syTarget - s.sy.s) - 9 * s.sy.v) * dt;
      s.sy.s += s.sy.v * dt;
      if (Math.abs(s.sy.s - 1) > 0.002 || Math.abs(s.sy.v) > 0.02)
        still = false;

      // Break the neck once the bodies are far enough apart.
      const sep = Math.abs(s.a.x - s.b.x);
      const radius =
        T.r * (1 - 0.3 * Math.min(sep / (2 * (T.q + T.r) || 1), 1));
      if (!s.split && s.moving && sep - 2 * T.q - 2 * radius > -6) {
        s.split = true;
        const tailBody = bodies[1 - s.lead];
        const headBody = bodies[s.lead];
        [0.3, 0.5, 0.72].forEach((t, j) => {
          s.sats.push({
            x:
              tailBody.x +
              (headBody.x - tailBody.x) * t +
              (Math.random() - 0.5) * 6,
            y: T.cy + (Math.random() - 0.5) * 10,
            vx: (tailBody.v + headBody.v) * 0.45,
            vy: (Math.random() - 0.5) * 60,
            r: 5 + Math.random() * 3 - j * 0.5,
            k: 70 + Math.random() * 90,
          });
        });
      }

      s.sats = s.sats.filter((d) => {
        d.vx += (d.k * (T.x - d.x) - 9 * d.vx) * dt;
        d.vy += (90 * (T.cy - d.y) - 7 * d.vy) * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.x = Math.max(PAD + 8 + d.r, Math.min(PAD + s.w - 8 - d.r, d.x));
        d.y = Math.max(T.cy - T.r + d.r, Math.min(T.cy + T.r - d.r, d.y));
        if (Math.abs(T.x - d.x) < T.q + T.r * 0.5) d.r -= dt * 26;
        return d.r > 0.6;
      });
      if (s.sats.length) still = false;
    }

    if (s.moving && still) {
      s.moving = false;
      if (s.split || !s.reduce) {
        s.rips.push({
          x: T.x,
          y: T.cy,
          age: 0,
          amp: s.split ? 1.2 : 0.7,
        });
      }
    }

    s.rips.forEach((p) => (p.age += dt));
    s.rips = s.rips.filter((p) => p.age < 2.4);
    const mouseTarget = s.mouse.on ? 1 : 0;
    s.mouse.s += (mouseTarget - s.mouse.s) * Math.min(1, dt * 7);
  }, []);

  const loop = React.useCallback(() => {
    const s = st.current;
    if (s.raf) return;
    s.last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - s.last) / 1000, 1 / 30);
      s.last = now;
      step(dt, now);
      draw();
      const busy =
        s.moving || s.rips.length || s.sats.length || s.mouse.s > 0.01;
      // Ambient water keeps moving while visible; reduced motion only
      // animates on change.
      if (s.visible && (!s.reduce || busy)) s.raf = requestAnimationFrame(tick);
      else s.raf = 0;
    };
    s.raf = requestAnimationFrame(tick);
  }, [draw, step]);

  /** Reads the current cell geometry into the physics target. */
  const measure = React.useCallback(() => {
    const root = rootRef.current;
    const box = host();
    if (!root || !box) return;

    const s = st.current;
    s.w = root.offsetWidth;
    s.h = root.offsetHeight;

    const index = targetIndex();
    if (index < 0 && s.ready) return;
    const cell = cells()[index < 0 ? 0 : index];
    if (!cell) return;

    const boxRect = root.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const T = s.t;
    T.r = cellRect.height / 2;
    T.q = Math.max(0, cellRect.width / 2 - T.r);
    T.cy = PAD + (cellRect.top - boxRect.top) + cellRect.height / 2;

    const nx = PAD + (cellRect.left - boxRect.left) + cellRect.width / 2;
    if (!s.ready) {
      s.a.x = s.b.x = nx;
      s.q = T.q;
      s.ready = true;
    } else if (Math.abs(nx - T.x) > 0.5) {
      s.lead = Math.abs(nx - s.a.x) <= Math.abs(nx - s.b.x) ? 0 : 1;
      s.lagFrom = performance.now() + 70;
      s.moving = true;
      s.split = false;
    }
    T.x = nx;

    const canvas = canvasRef.current;
    if (canvas) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = s.w + PAD * 2;
      const h = s.h + PAD * 2;
      if (
        canvas.width !== Math.round(w * dpr) ||
        canvas.height !== Math.round(h * dpr)
      ) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
    }

    loop();
  }, [cells, host, loop, targetIndex]);

  const ripple = React.useCallback(
    (x: number, y: number, amp: number) => {
      const s = st.current;
      if (s.reduce) return;
      s.rips.push({ x, y, age: 0, amp });
      loop();
    },
    [loop],
  );

  // Keeps the loop's tone in sync without rebuilding it.
  React.useEffect(() => {
    darkRef.current = tone === "dark" ? 1 : 0;
    loop();
  }, [tone, loop]);

  React.useEffect(() => {
    const s = st.current;
    s.reduce = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")
      .matches;

    const canvas = canvasRef.current;
    s.glc = canvas ? initGL(canvas) : null;
    if (!s.glc) setGl("off");

    const onLost = (event: Event) => {
      event.preventDefault();
      s.glc = null;
      setGl("off");
    };
    canvas?.addEventListener("webglcontextlost", onLost);

    const observer = new IntersectionObserver(([entry]) => {
      s.visible = entry.isIntersecting;
      if (s.visible) loop();
    });
    if (rootRef.current) observer.observe(rootRef.current);

    // Pausing off-screen also covers the tab being hidden.
    const onVisibility = () => {
      s.visible = document.visibilityState === "visible";
      if (s.visible) loop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const box = host();
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const list = cells();
      const index = list.findIndex((cell) =>
        cell.contains(event.target as Node),
      );
      if (index !== s.hover) {
        s.hover = index < 0 ? null : index;
        measure();
      }
      s.mouse.x = event.clientX - rect.left + PAD;
      s.mouse.y = event.clientY - rect.top + PAD;
      s.mouse.on = true;
      loop();
    };
    const onLeave = () => {
      s.mouse.on = false;
      if (s.hover !== null) {
        s.hover = null;
        measure();
      }
      loop();
    };
    const onDown = (event: PointerEvent) => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      ripple(
        event.clientX - rect.left + PAD,
        event.clientY - rect.top + PAD,
        0.8,
      );
    };

    box?.addEventListener("pointermove", onMove);
    box?.addEventListener("pointerleave", onLeave);
    box?.addEventListener("pointerdown", onDown);

    // Keyboard opening a panel, or route changes, move the drop without
    // any pointer involvement.
    const mutations = new MutationObserver(() => measure());
    if (box) {
      mutations.observe(box, {
        subtree: true,
        attributes: true,
        attributeFilter: ["data-state", "aria-current"],
      });
    }

    const resize = new ResizeObserver(() => {
      st.current.ready = false;
      measure();
    });
    if (rootRef.current) resize.observe(rootRef.current);

    measure();

    return () => {
      canvas?.removeEventListener("webglcontextlost", onLost);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
      mutations.disconnect();
      resize.disconnect();
      box?.removeEventListener("pointermove", onMove);
      box?.removeEventListener("pointerleave", onLeave);
      box?.removeEventListener("pointerdown", onDown);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [cells, host, loop, measure, ripple]);

  return (
    <span
      ref={rootRef}
      aria-hidden
      data-gl={gl}
      data-tone={tone}
      className={["pointer-events-none absolute select-none isolate", className]
        .filter(Boolean)
        .join(" ")}
      style={
        {
          "--lg-tint":
            tone === "dark" ? "rgba(10,18,40,.26)" : "rgba(255,255,255,.42)",
          "--lg-rim":
            tone === "dark" ? "rgba(255,255,255,.34)" : "rgba(255,255,255,.8)",
          // A hairline in the brand navy: white glass on a white page would
          // otherwise have no edge at all.
          "--lg-edge":
            tone === "dark" ? "rgba(255,255,255,.24)" : "rgba(13,42,107,.10)",
        } as React.CSSProperties
      }
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <span className="lg-nav-glass" />
      <canvas ref={canvasRef} className="lg-nav-water" />
      <span ref={dropRef} className="lg-nav-drop" />
    </span>
  );
}

export default LiquidNavLayer;

/**
 * The same glass, one row at a time, inside an open dropdown.
 *
 * The bar's drop is a horizontal capsule: its physics slide left and right
 * along a row of items, so it cannot follow a stack of rows down a panel. This
 * keeps the material and the springy settle, and lets CSS carry the movement:
 * the span is resized and translated to the hovered row, and the transform
 * transition overshoots slightly, which is what the water does.
 *
 * Contract: it lives inside `[data-liquid-panel]` and every row it should
 * track carries `data-liquid-row`. It is decorative and inert.
 */
export function LiquidPanelGlass() {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const glass = ref.current;
    const host = glass?.closest<HTMLElement>("[data-liquid-panel]");
    if (!glass || !host) return;

    let current: HTMLElement | null = null;
    const place = (row: HTMLElement | null) => {
      if (row === current) return;
      current = row;
      if (!row) {
        glass.style.opacity = "0";
        return;
      }
      const hostRect = host.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      glass.style.width = `${rowRect.width}px`;
      glass.style.height = `${rowRect.height}px`;
      glass.style.transform = `translate3d(${rowRect.left - hostRect.left}px, ${rowRect.top - hostRect.top}px, 0)`;
      glass.style.opacity = "1";
    };

    // Rows only hand over when the pointer is actually on one. Crossing the
    // 4px gap between two rows keeps the last one lit instead of blinking off.
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const row = (event.target as Element | null)?.closest(
        "[data-liquid-row]",
      );
      if (row instanceof HTMLElement) place(row);
    };
    const onLeave = () => place(null);
    // A resize can move the rows under a pointer that is standing still.
    const onResize = () => {
      const row = current;
      current = null;
      place(row);
    };

    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", onResize);
    return () => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <span ref={ref} aria-hidden className="lg-row-glass" />;
}

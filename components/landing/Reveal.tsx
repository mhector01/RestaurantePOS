"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Aparece con un desliz suave al entrar en pantalla (sin animación si el usuario la desactivó). */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "li" | "section" | "article";
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none",
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6 motion-reduce:opacity-100 motion-reduce:translate-y-0",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Barra superior que se vuelve sólida al bajar. */
export function StickyNav({ children }: { children: React.ReactNode }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        solid ? "bg-ink-950/85 backdrop-blur-xl border-b border-white/8" : "bg-transparent border-b border-transparent",
      )}
    >
      {children}
    </header>
  );
}

/** Cifra que sube hasta su valor al aparecer. */
export function CountUp({ to, suffix = "", prefix = "" }: { to: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setN(to);
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / 1200);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return (
    <span ref={ref} className="tabular">
      {prefix}
      {n}
      {suffix}
    </span>
  );
}

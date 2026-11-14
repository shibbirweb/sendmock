"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithoutRef,
} from "react";
import {
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";

import { cn } from "@/lib/utils";

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number;
  startValue?: number;
  direction?: "up" | "down";
  delay?: number;
  decimalPlaces?: number;
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(direction === "down" ? value : startValue);
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  });
  const isInView = useInView(ref, { once: true, margin: "0px" });
  const shouldReduceMotion = useReducedMotion();
  const formatNumber = (numberValue: number) =>
    Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(Number(numberValue.toFixed(decimalPlaces)));

  // The static HTML carries the final value (readable without JS and with
  // reduced motion, WS-02.2); with motion allowed it counts up from the start.
  useLayoutEffect(() => {
    if (!shouldReduceMotion && !isInView && ref.current) {
      ref.current.textContent = formatNumber(
        direction === "down" ? value : startValue,
      );
    }
    // Only before the first count-up; formatNumber is stable for these props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldReduceMotion]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (isInView && !shouldReduceMotion) {
      timer = setTimeout(() => {
        motionValue.set(direction === "down" ? startValue : value);
      }, delay * 1000);
    }

    return () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [
    motionValue,
    isInView,
    shouldReduceMotion,
    delay,
    value,
    direction,
    startValue,
  ]);

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) {
          ref.current.textContent = formatNumber(latest);
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [springValue, decimalPlaces],
  );

  return (
    <span
      ref={ref}
      className={cn(
        "inline-block tracking-wider text-fd-foreground tabular-nums",
        className,
      )}
      {...props}
    >
      {formatNumber(direction === "down" ? startValue : value)}
    </span>
  );
}

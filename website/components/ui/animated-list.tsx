"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type MotionProps,
} from "motion/react";

import { cn } from "@/lib/utils";

export function AnimatedListItem({ children }: { children: React.ReactNode }) {
  const animations: MotionProps = {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1, originY: 0 },
    exit: { scale: 0, opacity: 0 },
    transition: { type: "spring", stiffness: 350, damping: 40 },
  };

  return (
    <motion.div {...animations} layout className="mx-auto w-full">
      {children}
    </motion.div>
  );
}

export interface AnimatedListProps extends ComponentPropsWithoutRef<"div"> {
  children: React.ReactNode;
  delay?: number;
}

export const AnimatedList = React.memo(
  ({ children, className, delay = 1000, ...props }: AnimatedListProps) => {
    const [index, setIndex] = useState(0);
    const childrenArray = useMemo(
      () => React.Children.toArray(children),
      [children],
    );
    // WS-02.2: with reduced motion every item is shown at once, without springs.
    const shouldReduceMotion = useReducedMotion();
    const visibleIndex = shouldReduceMotion ? childrenArray.length - 1 : index;

    useEffect(() => {
      let timeout: ReturnType<typeof setTimeout> | null = null;

      if (!shouldReduceMotion && index < childrenArray.length - 1) {
        timeout = setTimeout(() => {
          setIndex((prevIndex) => (prevIndex + 1) % childrenArray.length);
        }, delay);
      }

      return () => {
        if (timeout !== null) {
          clearTimeout(timeout);
        }
      };
    }, [index, delay, childrenArray.length, shouldReduceMotion]);

    const itemsToShow = useMemo(
      () => childrenArray.slice(0, visibleIndex + 1).reverse(),
      [visibleIndex, childrenArray],
    );

    if (shouldReduceMotion) {
      return (
        <div
          className={cn("flex flex-col items-center gap-4", className)}
          {...props}
        >
          {itemsToShow.map((item) => (
            <div key={(item as React.ReactElement).key} className="w-full">
              {item}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div
        className={cn("flex flex-col items-center gap-4", className)}
        {...props}
      >
        <AnimatePresence>
          {itemsToShow.map((item) => (
            <AnimatedListItem key={(item as React.ReactElement).key}>
              {item}
            </AnimatedListItem>
          ))}
        </AnimatePresence>
      </div>
    );
  },
);

AnimatedList.displayName = "AnimatedList";

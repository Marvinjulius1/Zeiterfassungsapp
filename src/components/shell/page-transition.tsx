"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { spring } from "@/design-system/motion";

/** Weicher Übergang beim Seitenwechsel (Spring, respektiert reduced motion). */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.gentle}
    >
      {children}
    </motion.div>
  );
}

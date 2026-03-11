"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type CardProps = HTMLMotionProps<"div"> & {
  /** 是否执行入场动画。对静态容器（如表单区域）设为 false 避免状态更新时重复触发。默认 true */
  entryAnimation?: boolean;
};

export function Card({ children, className, entryAnimation = true, ...props }: CardProps) {
  return (
    <motion.div
      initial={entryAnimation ? { opacity: 0, y: 12 } : false}
      animate={entryAnimation ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "card-gradient rounded-3xl p-6",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

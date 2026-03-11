"use client";

import { motion, HTMLMotionProps } from "framer-motion";

export function Animate({ children, ...props }: HTMLMotionProps<"div">) {
    return <motion.div {...props}>{children}</motion.div>;
}

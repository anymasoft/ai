import type { HTMLAttributes } from "react";

type MarqueeProps = HTMLAttributes<HTMLDivElement>;

export function Marquee({ children, ...props }: MarqueeProps) {
  return (
    <div
      {...props}
      style={{
        display: "flex",
        overflowX: "auto",
        whiteSpace: "nowrap",
        ...props.style,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "1rem",
          animation: "marquee 30s linear infinite",
        }}
      >
        {children}
      </div>
      <style>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(calc(-100% - 1rem));
          }
        }
      `}</style>
    </div>
  );
}

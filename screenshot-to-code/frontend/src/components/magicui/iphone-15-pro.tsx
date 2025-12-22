import type { ImgHTMLAttributes } from "react";

type Iphone15ProProps = ImgHTMLAttributes<HTMLImageElement>;

export function Iphone15Pro({ ...props }: Iphone15ProProps) {
  return (
    <div className="relative">
      <img
        {...props}
        style={{
          width: "100%",
          height: "auto",
          ...props.style,
        }}
      />
    </div>
  );
}

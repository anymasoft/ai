/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * twitter.tsx
 * Copyright (C) 2025 Nextify Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 */

import type {SVGProps} from "react";
import { cn } from "@libra/ui/lib/utils";

// biome-ignore lint/a11y/noSvgWithoutTitle: <explanation>
const XformerlyTwitter = (props: SVGProps<SVGSVGElement>) => {
  const { className, ...restProps } = props;
  
  return (
    <div className={cn("relative", className)} style={{ width: '1em', height: '1em' }}>
      {/* Light theme version - black icon */}
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="1em"
        height="1em" 
        fill="none"
        viewBox="0 0 1200 1227" 
        className="block dark:hidden transition-opacity duration-300"
        {...restProps}
      >
        <title>X (formerly Twitter)</title>
        <path 
          fill="#000"
          d="M714.163 519.284 1160.89 0h-105.86L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.625-476.152 327.181 476.152H1200L714.137 519.284h.026ZM569.165 687.828l-47.468-67.894-377.686-540.24h162.604l304.797 435.991 47.468 67.894 396.2 566.721H892.476L569.165 687.854v-.026Z"
        />
      </svg>
      
      {/* Dark theme version - white icon */}
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="1em"
        height="1em" 
        fill="none"
        viewBox="0 0 1200 1227" 
        className="hidden dark:block transition-opacity duration-300 absolute top-0 left-0"
        {...restProps}
      >
        <title>X (formerly Twitter)</title>
        <path 
          fill="#fff"
          d="M714.163 519.284 1160.89 0h-105.86L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.625-476.152 327.181 476.152H1200L714.137 519.284h.026ZM569.165 687.828l-47.468-67.894-377.686-540.24h162.604l304.797 435.991 47.468 67.894 396.2 566.721H892.476L569.165 687.854v-.026Z"
        />
      </svg>
    </div>
  );
};

export default XformerlyTwitter;
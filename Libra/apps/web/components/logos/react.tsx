/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * react.tsx
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

const React = (props: React.SVGProps<SVGSVGElement>) => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: <explanation>
<svg
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M12 14.1164C13.1572 14.1164 14.0952 13.1689 14.0952 12C14.0952 10.8311 13.1572 9.8836 12 9.8836C10.8428 9.8836 9.90476 10.8311 9.90476 12C9.90476 13.1689 10.8428 14.1164 12 14.1164Z"
      fill="currentColor"
    />
    <path
      d="M12 16.7619C17.7858 16.7619 22.4762 14.6299 22.4762 12C22.4762 9.37007 17.7858 7.2381 12 7.2381C6.21416 7.2381 1.52381 9.37007 1.52381 12C1.52381 14.6299 6.21416 16.7619 12 16.7619Z"
      stroke="currentColor"
      strokeWidth={1.5}
    />
    <path
      d="M7.91731 14.381C10.8102 19.4423 14.9833 22.4793 17.2381 21.1643C19.4929 19.8493 18.9756 14.6803 16.0827 9.61905C13.1898 4.55775 9.01671 1.52075 6.7619 2.83571C4.5071 4.15067 5.02439 9.31965 7.91731 14.381Z"
      stroke="currentColor"
      strokeWidth={1.5}
    />
    <path
      d="M7.91731 9.61905C5.02439 14.6803 4.5071 19.8493 6.7619 21.1643C9.01671 22.4793 13.1898 19.4423 16.0827 14.381C18.9756 9.31965 19.4929 4.15067 17.2381 2.83571C14.9833 1.52075 10.8102 4.55775 7.91731 9.61905Z"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  </svg>
);
export default React;

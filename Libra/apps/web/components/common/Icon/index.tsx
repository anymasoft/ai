/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * index.tsx
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

import Image from 'next/image'
import * as m from '@/paraglide/messages'

interface RollbackIconProps {
  className?: string
  alt?: string
}

export const RollbackIcon = ({
  className = 'h-6 w-6',
  alt = m["icon.rollback.alt"]()
}: RollbackIconProps) => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 512 512"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M1427 3812 c-440 -441 -507 -511 -507 -537 0 -26 67 -96 507 -537 480 -480 510 -508 543 -508 33 0 50 15 228 193 160 161 192 198 192 222 0 23 -25 53 -135 165 -74 75 -135 139 -135 144 0 4 294 6 653 4 632 -4 654 -5 732 -26 143 -39 238 -94 346 -202 75 -74 104 -112 136 -175 70 -136 88 -210 88 -360 0 -108 -4 -143 -24 -205 -42 -136 -96 -225 -196 -325 -101 -101 -180 -152 -300 -193 l-80 -27 -1513 -5 -1514 -5 -24 -28 -24 -28 0 -263 c0 -252 1 -264 21 -290 l21 -26 1546 3 c1704 3 1577 -2 1772 63 320 107 604 338 770 628 64 111 114 233 143 346 199 767 -269 1539 -1041 1719 -143 34 -299 40 -932 41 l-584 0 137 138 c112 113 137 144 137 167 0 24 -32 61 -192 222 -178 178 -195 193 -228 193 -33 0 -63 -28 -543 -508z m660 206 l113 -112 -180 -181 c-193 -194 -200 -206 -160 -258 l20 -25 793 -5 c758 -4 796 -5 885 -25 135 -30 215 -58 326 -115 335 -171 570 -480 652 -859 25 -112 25 -380 0 -488 -99 -444 -406 -790 -824 -930 -186 -62 -124 -60 -1708 -60 l-1444 0 0 160 0 160 1435 0 c1580 0 1503 -3 1665 61 267 106 474 341 551 624 31 114 32 345 1 457 -93 339 -343 583 -688 670 -88 23 -93 23 -861 23 l-771 0 -26 -24 c-17 -16 -26 -35 -26 -55 0 -27 24 -55 175 -206 96 -96 175 -179 175 -185 0 -6 -50 -60 -110 -120 l-110 -110 -425 425 c-234 234 -425 429 -425 435 0 10 840 855 850 855 2 0 55 -51 117 -112z" transform="translate(0,512) scale(0.1,-0.1)"/>
    </svg>
  )
}
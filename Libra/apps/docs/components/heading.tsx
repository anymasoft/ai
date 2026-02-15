/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * heading.tsx
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

"use client";

import {Link as LinkIcon} from "lucide-react";
import Link from "next/link";
import type {ComponentPropsWithoutRef} from "react";

type Types = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
type HeadingProps<T extends Types> = Omit<ComponentPropsWithoutRef<T>, "as"> & {
    as?: T;
};

export function Heading<T extends Types = "h1">({as, className, ...props}: HeadingProps<T>): React.ReactElement {
    const As = as ?? "h1";
    
    // Remove any non-standard props before passing to DOM element
    const { tw, ...restProps } = props as any;
    
    const headingProps = {
        ...restProps,
        ...(className && { className }),
    };

    if (!props.id) return <As {...headingProps} />;

    return (
        <As className={`flex scroll-m-28 flex-row items-center gap-2 ${className ?? ''}`} {...restProps}>
            <Link
                data-card=""
                href={`?id=${props.id}`}
                className="peer"
            >
                {props.children}
            </Link>
            <LinkIcon
                aria-label="Link to section"
                className="size-3.5 shrink-0 text-fd-muted-foreground opacity-0 transition-opacity peer-hover:opacity-100"
            />
        </As>
    );
}
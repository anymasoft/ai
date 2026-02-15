/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * scroller.tsx
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

import {usePathname, useSearchParams} from "next/navigation";
import {useEffect, useRef, useCallback} from "react";

export default function Scroller() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const isInitialMount = useRef(true);

    // Wrap handleScroll function with useCallback to avoid unnecessary recreation
    const handleScroll = useCallback(() => {
        // Get target ID - supports URL parameter (?id=foo) or anchor (#foo)
        const id = searchParams?.get("id") ?? window.location.hash.slice(1);
        
        if (!id) {
            return;
        }
        
        const el = document.getElementById(id);
        
        if (!el) {
            return;
        }
        
        // Use smooth scrolling effect to enhance user experience
        el.scrollIntoView({ 
            behavior: "smooth",
            block: "start"
        });
    }, [searchParams]);

    useEffect(() => {
        try {
            if (isInitialMount.current) {
                // Execute on initial load
                isInitialMount.current = false;
            }
            
            handleScroll();
        } catch (error) {
            console.error("[Scroller] Error during scroll handling:", error);
        }
    }, [pathname, handleScroll]);

    return null;
}
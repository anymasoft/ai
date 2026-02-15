/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * tiles.tsx
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

import * as React from "react";

import TailwindLogo from "../logos/tailwind";
import ReactLogo from "../logos/react";
import TypeScriptLogo from "../logos/typescript";
import ShadcnLogo from "../logos/shadcn-ui";
import FigmaLogo from "../logos/figma";
import {Beam} from "@libra/ui/components/beam";
import Glow from "@libra/ui/components/glow";

function TilesIllustration() {
    return (
        <div
            data-slot="tiles-illustration"
            className="relative grid h-[318px] w-[534px] grid-flow-col grid-cols-5 grid-rows-6 gap-6"
        >
            <div className="row-span-2 row-start-2"/>
            <div className="fade-left-lg bg-border/40 dark:bg-background/30 z-1 row-span-2 rounded-xl transition-all duration-1000 ease-in-out"/>
            <div className="fade-top-lg bg-border/40 dark:bg-background/30 z-1 row-span-2 rounded-xl transition-all duration-1000 ease-in-out"/>
            <div className="glass-4 outline-border/30 dark:outline-background/30 relative z-10 row-span-2 flex items-center justify-center rounded-xl to-transparent outline-4 transition-all duration-1000 ease-in-out group-hover:scale-105">
                <Beam tone="brandLight">
                    <div className="text-light relative z-10">
                        <TailwindLogo />
                    </div>
                </Beam>
            </div>
            <div className="fade-bottom-lg bg-border/40 dark:bg-background/30 z-1 row-span-2 rounded-xl transition-all duration-1000 ease-in-out"/>
            <div className="glass-4 outline-border/30 dark:outline-background/30 relative z-10 row-span-2 row-start-2 flex items-center justify-center rounded-xl to-transparent outline-4 transition-all duration-1000 ease-in-out group-hover:scale-90">
                <Beam tone="brandLight">
                    <div className="text-light relative z-10">
                        <ReactLogo />
                    </div>
                </Beam>
            </div>
            <div className="glass-4 outline-border/30 dark:outline-background/30 relative z-10 row-span-2 flex items-center justify-center rounded-xl to-transparent outline-4 transition-all duration-1000 ease-in-out">
                <Beam tone="brandLight">
                    <div className="text-light relative z-10">
                        <TypeScriptLogo />
                    </div>
                </Beam>
            </div>
            <div className="fade-top-lg bg-border/40 dark:bg-background/30 z-1 row-span-2 rounded-xl transition-all duration-1000 ease-in-out"/>
            <div className="glass-4 outline-border/30 dark:outline-background/30 relative z-10 row-span-2 flex items-center justify-center rounded-xl to-transparent outline-4 transition-all duration-1000 ease-in-out group-hover:scale-105">
                <Beam tone="brandLight">
                    <div className="text-light relative z-10">
                        <ShadcnLogo />
                    </div>
                </Beam>
            </div>
            <div className="glass-4 outline-border/30 dark:outline-background/30 relative z-10 row-span-2 row-start-2 flex items-center justify-center rounded-xl to-transparent outline-4 transition-all duration-1000 ease-in-out group-hover:scale-[.8]">
                <Beam tone="brandLight">
                    <div className="text-light relative z-10">
                        <FigmaLogo />
                    </div>
                </Beam>
            </div>
            <div className="fade-right-lg bg-border/40 dark:bg-background/30 z-1 row-span-2 rounded-xl transition-all duration-1000 ease-in-out"/>
            <Glow
                variant="center"
                className="scale-x-[1.5] opacity-20 transition-all duration-300 group-hover:opacity-30"
            />
        </div>
    );
}

export default TilesIllustration;
